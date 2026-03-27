import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.category import Category
from app.models.recurring_item import RecurringItem, RecurringType
from app.models.transaction import Transaction
from app.models.user import User
from app.routers.system import get_app_date
from app.schemas.recurring_item import MarkPaidNoTransactionRequest, MarkPaidRequest, RecurringCreate, RecurringOut, RecurringUpdate, RecurringSummaryOut
from app.services.recurring_service import mark_paid, mark_paid_no_transaction, match_unlinked_current_month
from app.utils.date_utils import rewind_by_frequency

router = APIRouter(prefix="/recurring", tags=["recurring"])


def _with_days_until_due(item: RecurringItem, today: date) -> RecurringOut:
    days = (item.next_due_date - today).days
    out = RecurringOut.model_validate(item)
    out.days_until_due = days
    if item.last_paid_date is not None and item.next_due_date > today:
        period_start = rewind_by_frequency(item.next_due_date, item.frequency)
        out.is_paid_current_period = item.last_paid_date >= period_start
    return out


@router.get("", response_model=list[RecurringOut])
async def list_recurring(
    type: Optional[RecurringType] = None,
    is_active: Optional[bool] = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = await get_app_date(db)
    q = select(RecurringItem).where(RecurringItem.deleted_at == None)
    if type:
        q = q.where(RecurringItem.type == type)
    if is_active is not None:
        q = q.where(RecurringItem.is_active == is_active)
    result = await db.execute(q.order_by(RecurringItem.next_due_date))
    return [_with_days_until_due(item, today) for item in result.scalars().all()]


@router.get("/upcoming", response_model=list[RecurringOut])
async def upcoming_recurring(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = await get_app_date(db)
    cutoff = today + timedelta(days=days)
    result = await db.execute(
        select(RecurringItem)
        .where(
            RecurringItem.is_active == True,
            RecurringItem.deleted_at == None,
            RecurringItem.next_due_date <= cutoff,
        )
        .order_by(RecurringItem.next_due_date)
    )
    return [_with_days_until_due(item, today) for item in result.scalars().all()]


@router.get("/summary", response_model=RecurringSummaryOut)
async def get_recurring_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get summary of actual amounts paid for subscriptions, bills, and income in the current month.
    Uses actual transaction amounts, with fallback for items paid without a transaction.
    """
    today = await get_app_date(db)
    month_start = today.replace(day=1)

    # Get all transactions linked to recurring items in the current month
    result = await db.execute(
        select(Transaction).where(
            Transaction.recurring_item_id != None,
            Transaction.deleted_at == None,
            Transaction.date >= month_start,
            Transaction.date <= today,
        )
    )
    transactions = result.scalars().all()

    # Get active recurring items to map transaction to type
    recurring_items_result = await db.execute(
        select(RecurringItem).where(
            RecurringItem.deleted_at == None,
            RecurringItem.is_active == True,
        )
    )
    recurring_items = {item.id: item for item in recurring_items_result.scalars().all()}

    # Calculate totals by type
    subscriptions_paid = Decimal("0")
    subscriptions_count = 0
    bills_paid = Decimal("0")
    bills_count = 0
    income_paid = Decimal("0")
    income_count = 0

    counted_item_ids: set[uuid.UUID] = set()

    for txn in transactions:
        item = recurring_items.get(txn.recurring_item_id)
        if not item:
            continue

        counted_item_ids.add(item.id)
        amount = abs(txn.amount)
        if item.type == RecurringType.subscription:
            subscriptions_paid += amount
            subscriptions_count += 1
        elif item.type == RecurringType.bill:
            bills_paid += amount
            bills_count += 1
        elif item.type == RecurringType.income:
            income_paid += amount
            income_count += 1

    # Fallback: include items paid via mark_paid_no_transaction (no Transaction created)
    for item in recurring_items.values():
        if item.id in counted_item_ids:
            continue
        if not item.last_paid_date:
            continue
        if item.last_paid_date < month_start or item.last_paid_date > today:
            continue
        amount = abs(item.last_paid_amount or item.amount)
        if item.type == RecurringType.subscription:
            subscriptions_paid += amount
            subscriptions_count += 1
        elif item.type == RecurringType.bill:
            bills_paid += amount
            bills_count += 1
        elif item.type == RecurringType.income:
            income_paid += amount
            income_count += 1

    return RecurringSummaryOut(
        subscriptions_paid=float(subscriptions_paid),
        subscriptions_count=subscriptions_count,
        bills_paid=float(bills_paid),
        bills_count=bills_count,
        income_paid=float(income_paid),
        income_count=income_count,
    )


async def _check_once_per_month_category(
    category_id: uuid.UUID | None,
    db: AsyncSession,
    exclude_item_id: uuid.UUID | None = None,
) -> None:
    """Raise 409 if category is once_per_month and already assigned to another active recurring item."""
    if not category_id:
        return
    cat = await db.get(Category, category_id)
    if not cat or not cat.once_per_month:
        return
    q = select(RecurringItem).where(
        RecurringItem.category_id == category_id,
        RecurringItem.deleted_at == None,
        RecurringItem.is_active == True,
    )
    if exclude_item_id:
        q = q.where(RecurringItem.id != exclude_item_id)
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Category '{cat.name}' is marked once-per-month and is already assigned to another active recurring bill.",
        )


@router.post("", response_model=RecurringOut, status_code=201)
async def create_recurring(
    data: RecurringCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _check_once_per_month_category(data.category_id, db)
    item = RecurringItem(**data.model_dump(), created_by=current_user.id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _with_days_until_due(item, await get_app_date(db))


@router.get("/{item_id}", response_model=RecurringOut)
async def get_recurring(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _with_days_until_due(await _get_or_404(item_id, db), await get_app_date(db))


@router.put("/{item_id}", response_model=RecurringOut)
async def update_recurring(
    item_id: uuid.UUID,
    data: RecurringUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await _get_or_404(item_id, db)
    new_category_id = data.model_dump(exclude_none=True).get("category_id", item.category_id)
    await _check_once_per_month_category(new_category_id, db, exclude_item_id=item_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await match_unlinked_current_month(item, db)
    await db.commit()
    await db.refresh(item)
    return _with_days_until_due(item, await get_app_date(db))


@router.delete("/{item_id}", status_code=204)
async def delete_recurring(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await _get_or_404(item_id, db)
    item.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{item_id}/mark-paid", response_model=RecurringOut, status_code=201)
async def mark_paid_endpoint(
    item_id: uuid.UUID,
    data: MarkPaidRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await _get_or_404(item_id, db)
    await mark_paid(item, db, current_user.id, data.date, data.amount, data.description, data.account_id, data.category_id, data.source_account_id)
    await db.refresh(item)
    return _with_days_until_due(item, await get_app_date(db))


@router.post("/{item_id}/mark-paid-no-transaction", response_model=RecurringOut, status_code=200)
async def mark_paid_no_transaction_endpoint(
    item_id: uuid.UUID,
    data: MarkPaidNoTransactionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await _get_or_404(item_id, db)
    await mark_paid_no_transaction(item, db, data.date, data.amount)
    await db.refresh(item)
    return _with_days_until_due(item, await get_app_date(db))


async def _get_or_404(item_id: uuid.UUID, db: AsyncSession) -> RecurringItem:
    result = await db.execute(
        select(RecurringItem).where(RecurringItem.id == item_id, RecurringItem.deleted_at == None)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring item not found")
    return item
