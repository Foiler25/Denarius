import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recurring_item import RecurringItem
from app.models.transaction import Transaction, TransactionType
from app.utils.date_utils import advance_by_frequency


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
        item.next_due_date = advance_by_frequency(item.next_due_date, item.frequency)
        posted += 1

    if posted:
        await db.commit()
    return posted
