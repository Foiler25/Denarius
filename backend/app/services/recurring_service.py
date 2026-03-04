import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category
from app.models.recurring_item import RecurringItem
from app.models.transaction import Transaction, TransactionType
from app.utils.date_utils import advance_by_frequency, rewind_by_frequency


async def mark_paid(
    item: RecurringItem,
    db: AsyncSession,
    created_by: uuid.UUID,
    payment_date: date | None = None,
    amount=None,
) -> Transaction:
    txn_date = payment_date or date.today()
    txn_amount = amount if amount is not None else item.amount
    txn_type = TransactionType.income if item.type.value == "income" else TransactionType.expense

    txn = Transaction(
        account_id=item.account_id,
        category_id=item.category_id,
        recurring_item_id=item.id,
        amount=txn_amount,
        type=txn_type,
        description=f"{item.name} (recurring)",
        date=txn_date,
        created_by=created_by,
    )
    db.add(txn)

    item.next_due_date = advance_by_frequency(item.next_due_date, item.frequency)
    await db.commit()
    await db.refresh(txn)

    item.last_paid_date = txn_date
    item.last_paid_amount = txn_amount
    item.last_paid_transaction_id = txn.id
    await db.commit()

    return txn


async def auto_post_due_items(db: AsyncSession) -> int:
    today = date.today()
    result = await db.execute(
        select(RecurringItem).where(
            RecurringItem.auto_post == True,
            RecurringItem.is_active == True,
            RecurringItem.next_due_date <= today,
            RecurringItem.deleted_at == None,
        )
    )
    items = result.scalars().all()
    posted = 0
    for item in items:
        txn_type = TransactionType.income if item.type.value == "income" else TransactionType.expense
        txn = Transaction(
            account_id=item.account_id,
            category_id=item.category_id,
            recurring_item_id=item.id,
            amount=item.amount,
            type=txn_type,
            description=f"{item.name} (auto-posted)",
            date=item.next_due_date,
            created_by=item.created_by,
        )
        db.add(txn)
        prev_due = item.next_due_date
        item.next_due_date = advance_by_frequency(item.next_due_date, item.frequency)
        item.last_paid_date = prev_due
        item.last_paid_amount = item.amount
        item.last_paid_transaction_id = None  # refreshed after commit below
        posted += 1

    if posted:
        await db.commit()
    return posted


def _amount_in_range(txn_amount: Decimal, item: RecurringItem) -> bool:
    """Return True if txn_amount falls within the item's configured amount range."""
    if item.amount_min is not None and item.amount_max is not None:
        return item.amount_min <= txn_amount <= item.amount_max
    # Fixed amount: allow ±5% tolerance
    tolerance = item.amount * Decimal("0.05")
    return abs(txn_amount - item.amount) <= tolerance


def _keywords_match(description: str | None, keyword_match: str) -> bool:
    """Return True if any comma-separated keyword appears in description (case-insensitive)."""
    desc = (description or "").lower()
    keywords = [k.strip().lower() for k in keyword_match.split(",") if k.strip()]
    return any(k in desc for k in keywords)


def _attach_to_item(txn: Transaction, item: RecurringItem) -> None:
    """Link a transaction to a recurring item and advance its tracking fields."""
    txn.recurring_item_id = item.id
    item.next_due_date = advance_by_frequency(item.next_due_date, item.frequency)
    item.last_paid_date = txn.date
    item.last_paid_amount = txn.amount
    item.last_paid_transaction_id = txn.id


async def find_and_attach_recurring(txn: Transaction, db: AsyncSession) -> RecurringItem | None:
    """
    Attempt to link a transaction to a recurring item.

    Pass 1 — category match (once_per_month categories only):
      If the transaction has a category that is marked once_per_month, find the
      active recurring item for that category and link immediately (no keyword/amount
      check needed — the category constraint is already explicit user intent).

    Pass 2 — keyword + amount match (auto_match items only):
      Fallback for transactions without a once_per_month category. Requires
      auto_match=True on the recurring item plus keyword and amount criteria.

    Returns the matched RecurringItem (with next_due_date already advanced) or None.
    """
    # Pass 1: category-first for once_per_month categories
    if txn.category_id:
        stmt = (
            select(RecurringItem)
            .join(Category, RecurringItem.category_id == Category.id)
            .where(
                RecurringItem.category_id == txn.category_id,
                RecurringItem.is_active == True,
                RecurringItem.deleted_at == None,
                Category.once_per_month == True,
                Category.deleted_at == None,
            )
        )
        cat_match = (await db.execute(stmt)).scalar_one_or_none()
        if cat_match:
            _attach_to_item(txn, cat_match)
            return cat_match

    # Pass 2: keyword + amount matching (requires auto_match=True)
    result = await db.execute(
        select(RecurringItem).where(
            RecurringItem.auto_match == True,
            RecurringItem.is_active == True,
            RecurringItem.deleted_at == None,
        )
    )
    candidates = result.scalars().all()

    txn_amount = abs(txn.amount)

    for item in candidates:
        # Must have at least a keyword or category configured to avoid false positives
        if not item.keyword_match and not item.category_id:
            continue

        # Keyword check
        if item.keyword_match and not _keywords_match(txn.description, item.keyword_match):
            continue

        # Amount range check
        if not _amount_in_range(txn_amount, item):
            continue

        # Category check — only a hard filter when both sides specify a category
        if item.category_id and txn.category_id and item.category_id != txn.category_id:
            continue

        # Match found — link and advance
        _attach_to_item(txn, item)
        return item

    return None


async def match_unlinked_current_month(item: RecurringItem, db: AsyncSession) -> bool:
    """
    After editing a recurring item, find and attach the most recent unlinked
    transaction from the current calendar month that matches the item's criteria.

    Only runs when auto_match is enabled and the item is not already marked paid
    for the current period. Returns True if a transaction was linked.
    """
    if not item.auto_match:
        return False
    if not item.keyword_match and not item.category_id:
        return False

    today = date.today()
    period_start = rewind_by_frequency(item.next_due_date, item.frequency)
    if item.last_paid_date is not None and item.last_paid_date >= period_start:
        return False

    month_start = today.replace(day=1)
    result = await db.execute(
        select(Transaction).where(
            Transaction.recurring_item_id == None,
            Transaction.deleted_at == None,
            Transaction.date >= month_start,
            Transaction.date <= today,
        ).order_by(Transaction.date.desc())
    )

    for txn in result.scalars().all():
        txn_amount = abs(txn.amount)
        if item.keyword_match and not _keywords_match(txn.description, item.keyword_match):
            continue
        if not _amount_in_range(txn_amount, item):
            continue
        if item.category_id and txn.category_id and item.category_id != txn.category_id:
            continue

        txn.recurring_item_id = item.id
        item.next_due_date = advance_by_frequency(item.next_due_date, item.frequency)
        item.last_paid_date = txn.date
        item.last_paid_amount = txn.amount
        item.last_paid_transaction_id = txn.id
        return True

    return False


async def detach_recurring(txn: Transaction, db: AsyncSession) -> None:
    """If this transaction is the current-period payment for a recurring item, revert it."""
    if txn.recurring_item_id is None:
        return
    item = await db.get(RecurringItem, txn.recurring_item_id)
    if item is None:
        return
    # Match by transaction ID (manual mark-paid / auto-match paths)
    # OR by date when ID wasn't captured (auto-post path sets last_paid_transaction_id = None)
    is_current_payment = (
        item.last_paid_transaction_id == txn.id
        or (item.last_paid_transaction_id is None and item.last_paid_date == txn.date)
    )
    if not is_current_payment:
        return
    item.next_due_date = rewind_by_frequency(item.next_due_date, item.frequency)
    item.last_paid_date = None
    item.last_paid_amount = None
    item.last_paid_transaction_id = None


async def update_recurring_item(txn: Transaction, db: AsyncSession) -> None:
    """If the transaction is linked to a recurring item, update the item's details."""
    if txn.recurring_item_id is None:
        return

    item = await db.get(RecurringItem, txn.recurring_item_id)
    if not item:
        return

    is_current_payment = (
        item.last_paid_transaction_id == txn.id
        or (item.last_paid_transaction_id is None and item.last_paid_date == txn.date)
    )
    if is_current_payment:
        item.last_paid_amount = txn.amount
        item.amount = txn.amount
