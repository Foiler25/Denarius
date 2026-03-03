import csv
import io
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone

from app.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.transaction import BulkDeleteRequest, TransactionCreate, TransactionOut, TransactionUpdate
from app.utils.pagination import PagedResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("", response_model=PagedResponse[TransactionOut])
async def list_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    account_id: Optional[uuid.UUID] = None,
    category_id: Optional[uuid.UUID] = None,
    type: Optional[TransactionType] = None,
    search: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    is_cleared: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Transaction).options(selectinload(Transaction.category)).where(Transaction.deleted_at == None)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if type:
        q = q.where(Transaction.type == type)
    if search:
        q = q.where(Transaction.description.ilike(f"%{search}%"))
    if start_date:
        q = q.where(Transaction.date >= start_date)
    if end_date:
        q = q.where(Transaction.date <= end_date)
    if is_cleared is not None:
        q = q.where(Transaction.is_cleared == is_cleared)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    offset = (page - 1) * limit
    result = await db.execute(q.order_by(Transaction.date.desc()).offset(offset).limit(limit))
    items = result.scalars().all()
    return PagedResponse(items=items, total=total, page=page, pages=-(-total // limit), limit=limit)


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = Transaction(**data.model_dump(), created_by=current_user.id)
    db.add(txn)

    # Update account balance
    account = await db.get(Account, data.account_id)
    if account:
        if data.type == TransactionType.expense:
            account.current_balance -= data.amount
        elif data.type == TransactionType.income:
            account.current_balance += data.amount
        elif data.type == TransactionType.transfer and data.transfer_account_id:
            account.current_balance -= data.amount
            dest = await db.get(Account, data.transfer_account_id)
            if dest:
                dest.current_balance += data.amount
                # Create the matching transfer transaction on destination side
                dest_txn = Transaction(
                    account_id=data.transfer_account_id,
                    category_id=data.category_id,
                    transfer_account_id=data.account_id,
                    amount=data.amount,
                    type=TransactionType.income,
                    description=data.description,
                    notes=data.notes,
                    date=data.date,
                    is_cleared=data.is_cleared,
                    created_by=current_user.id,
                )
                db.add(dest_txn)

    await db.commit()
    await db.refresh(txn)
    return txn


@router.get("/export")
async def export_transactions(
    account_id: Optional[uuid.UUID] = None,
    category_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Transaction).options(selectinload(Transaction.category)).where(Transaction.deleted_at == None)
    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if start_date:
        q = q.where(Transaction.date >= start_date)
    if end_date:
        q = q.where(Transaction.date <= end_date)
    result = await db.execute(q.order_by(Transaction.date.desc()))
    transactions = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Description", "Amount", "Category", "Cleared"])
    for t in transactions:
        writer.writerow([
            t.date.isoformat(),
            t.type.value,
            t.description or "",
            str(t.amount),
            t.category.name if t.category else "",
            "Yes" if t.is_cleared else "No",
        ])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_or_404(transaction_id, db)


@router.put("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: uuid.UUID,
    data: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = await _get_or_404(transaction_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(txn, field, value)
    await db.commit()
    await db.refresh(txn)
    return txn


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = await _get_or_404(transaction_id, db)
    txn.deleted_at = datetime.now(timezone.utc)
    await db.commit()


@router.post("/bulk-delete", status_code=204)
async def bulk_delete(
    data: BulkDeleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Transaction).where(Transaction.id.in_(data.ids), Transaction.deleted_at == None)
    )
    for txn in result.scalars().all():
        txn.deleted_at = now
    await db.commit()


async def _get_or_404(transaction_id: uuid.UUID, db: AsyncSession) -> Transaction:
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category))
        .where(Transaction.id == transaction_id, Transaction.deleted_at == None)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn
