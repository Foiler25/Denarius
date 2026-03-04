import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    txn_amount = amount or item.amount
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


async def find_and_attach_recurring(txn: Transaction, db: AsyncSession) -> RecurringItem | None:
    """
    Check all auto_match-enabled recurring items to see if this transaction matches.
    A match requires:
      - keyword_match set on the item: all keywords must appear in the transaction description
      - amount within the configured range (exact ±5% or min–max range)
      - if both item and transaction have a category, they must agree

    Returns the matched RecurringItem (with next_due_date already advanced) or None.
    """
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
        txn.recurring_item_id = item.id
        item.next_due_date = advance_by_frequency(item.next_due_date, item.frequency)
        item.last_paid_date = txn.date
        item.last_paid_amount = txn.amount
        item.last_paid_transaction_id = txn.id
        return item

    return None


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
