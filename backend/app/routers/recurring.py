import uuid
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.recurring_item import RecurringItem, RecurringType
from app.models.user import User
from app.schemas.recurring_item import MarkPaidRequest, RecurringCreate, RecurringOut, RecurringUpdate
from app.services.recurring_service import mark_paid

router = APIRouter(prefix="/recurring", tags=["recurring"])


def _with_days_until_due(item: RecurringItem) -> RecurringOut:
    today = date.today()
    days = (item.next_due_date - today).days
    out = RecurringOut.model_validate(item)
    out.days_until_due = days
    return out


@router.get("", response_model=list[RecurringOut])
async def list_recurring(
    type: Optional[RecurringType] = None,
    is_active: Optional[bool] = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(RecurringItem).where(RecurringItem.deleted_at == None)
    if type:
        q = q.where(RecurringItem.type == type)
    if is_active is not None:
        q = q.where(RecurringItem.is_active == is_active)
    result = await db.execute(q.order_by(RecurringItem.next_due_date))
    return [_with_days_until_due(item) for item in result.scalars().all()]


@router.get("/upcoming", response_model=list[RecurringOut])
async def upcoming_recurring(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timedelta
    cutoff = date.today() + timedelta(days=days)
    result = await db.execute(
        select(RecurringItem)
        .where(
            RecurringItem.is_active == True,
            RecurringItem.deleted_at == None,
            RecurringItem.next_due_date <= cutoff,
        )
        .order_by(RecurringItem.next_due_date)
    )
    return [_with_days_until_due(item) for item in result.scalars().all()]


@router.post("", response_model=RecurringOut, status_code=201)
async def create_recurring(
    data: RecurringCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = RecurringItem(**data.model_dump(), created_by=current_user.id)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return _with_days_until_due(item)


@router.get("/{item_id}", response_model=RecurringOut)
async def get_recurring(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _with_days_until_due(await _get_or_404(item_id, db))


@router.put("/{item_id}", response_model=RecurringOut)
async def update_recurring(
    item_id: uuid.UUID,
    data: RecurringUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await _get_or_404(item_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return _with_days_until_due(item)


@router.delete("/{item_id}", status_code=204)
async def delete_recurring(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await _get_or_404(item_id, db)
    item.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/{item_id}/mark-paid", status_code=201)
async def mark_paid_endpoint(
    item_id: uuid.UUID,
    data: MarkPaidRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await _get_or_404(item_id, db)
    txn = await mark_paid(item, db, current_user.id, data.date, data.amount)
    return {"transaction_id": str(txn.id), "next_due_date": str(item.next_due_date)}


async def _get_or_404(item_id: uuid.UUID, db: AsyncSession) -> RecurringItem:
    result = await db.execute(
        select(RecurringItem).where(RecurringItem.id == item_id, RecurringItem.deleted_at == None)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Recurring item not found")
    return item
