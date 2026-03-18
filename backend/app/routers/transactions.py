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
from app.models.category import Category
from app.models.expense_account import ExpenseAccount
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.transaction import BulkDeleteRequest, TransactionCreate, TransactionOut, TransactionUpdate
from app.services.recurring_service import (
    detach_recurring,
    find_and_attach_recurring,
    update_recurring_item,
)
from app.utils.pagination import PagedResponse

router = APIRouter(prefix="/transactions", tags=["transactions"])


async def _check_once_per_month_transaction(
    category_id: uuid.UUID | None,
    txn_date: date,
    db: AsyncSession,
    exclude_txn_id: uuid.UUID | None = None,
    override: str | None = None,
) -> None:
    """Raise 409 if category is once_per_month and a transaction already exists this month, unless overridden."""
    if not category_id or override:
        return
    cat = await db.get(Category, category_id)
    if not cat or not cat.once_per_month:
        return
    month_start = txn_date.replace(day=1)
    month_end = (
        month_start.replace(year=month_start.year + 1, month=1, day=1)
        if month_start.month == 12
        else month_start.replace(month=month_start.month + 1)
    )
    q = select(Transaction).where(
        Transaction.category_id == category_id,
        Transaction.date >= month_start,
        Transaction.date < month_end,
        Transaction.deleted_at == None,
    )
    if exclude_txn_id:
        q = q.where(Transaction.id != exclude_txn_id)
    existing = (await db.execute(q)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Category '{cat.name}' is marked once-per-month and already has a transaction this month.",
            headers={"X-Conflict": "once_per_month"},
        )


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
    expense_account_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Transaction).options(selectinload(Transaction.category), selectinload(Transaction.recurring_item), selectinload(Transaction.account), selectinload(Transaction.expense_account)).where(Transaction.deleted_at == None, Transaction.is_hidden != True)
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
    if expense_account_id:
        q = q.where(Transaction.expense_account_id == expense_account_id)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()
    offset = (page - 1) * limit
    result = await db.execute(q.order_by(Transaction.date.desc()).offset(offset).limit(limit))
    items = result.scalars().all()
    return PagedResponse(items=items, total=total, page=page, pages=-(-total // limit), limit=limit)


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    txn = (
        await db.execute(
            select(Transaction)
            .options(
                selectinload(Transaction.category),
                selectinload(Transaction.account),
                selectinload(Transaction.expense_account),
            )
            .where(Transaction.id == transaction_id, Transaction.deleted_at == None)
        )
    ).scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    data: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    override = data.once_per_month_override
    await _check_once_per_month_transaction(data.category_id, data.date, db, override=override)

    txn = Transaction(**data.model_dump(exclude={"once_per_month_override"}), created_by=current_user.id)
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
                    paired_transaction_id=txn.id,
                    amount=data.amount,
                    type=TransactionType.transfer,
                    description=data.description,
                    notes=data.notes,
                    date=data.date,
                    created_by=current_user.id,
                )
                db.add(dest_txn)

    # Auto-match to a recurring item if one is configured for this transaction.
    # extra_payment skips matching (standalone payment, don't advance next_due_date).
    # next_month_payment runs matching so the recurring item advances an extra cycle.
    if override != "extra_payment" and not data.model_dump(exclude={"once_per_month_override"}).get("recurring_item_id"):
        await find_and_attach_recurring(txn, db)

    await db.commit()
    return await _get_or_404(txn.id, db)


@router.get("/export")
async def export_transactions(
    account_id: Optional[uuid.UUID] = None,
    category_id: Optional[uuid.UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(Transaction).options(selectinload(Transaction.category)).where(Transaction.deleted_at == None, Transaction.is_hidden != True)
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
    writer.writerow(["Date", "Type", "Description", "Amount", "Category"])
    for t in transactions:
        writer.writerow([
            t.date.isoformat(),
            t.type.value,
            t.description or "",
            str(t.amount),
            t.category.name if t.category else "",
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
    had_recurring = txn.recurring_item_id is not None
    override = data.once_per_month_override

    # Snapshot state needed for balance adjustment and transfer counterpart lookup
    old_amount = txn.amount
    old_date = txn.date

    for field, value in data.model_dump(exclude_none=True, exclude={"once_per_month_override"}).items():
        setattr(txn, field, value)

    await _check_once_per_month_transaction(txn.category_id, txn.date, db, exclude_txn_id=txn.id, override=override)

    amount_delta = txn.amount - old_amount

    if txn.type == TransactionType.transfer and txn.transfer_account_id:
        # Find the counterpart transfer leg using pre-edit values
        dest_result = await db.execute(
            select(Transaction).where(
                Transaction.account_id == txn.transfer_account_id,
                Transaction.transfer_account_id == txn.account_id,
                Transaction.amount == old_amount,
                Transaction.date == old_date,
                Transaction.deleted_at == None,
            )
        )
        dest_txn = dest_result.scalar_one_or_none()

        is_destination = txn.paired_transaction_id is not None

        if amount_delta != 0:
            this_account = await db.get(Account, txn.account_id)
            if this_account:
                if is_destination:
                    this_account.current_balance += amount_delta
                else:
                    this_account.current_balance -= amount_delta
            if dest_txn:
                dest_txn.amount = txn.amount
                other_account = await db.get(Account, dest_txn.account_id)
                if other_account:
                    if is_destination:
                        other_account.current_balance -= amount_delta
                    else:
                        other_account.current_balance += amount_delta

        # Sync metadata fields to counterpart leg
        if dest_txn:
            dest_txn.date = txn.date
            dest_txn.description = txn.description
            dest_txn.notes = txn.notes
            dest_txn.category_id = txn.category_id

    elif amount_delta != 0:
        account = await db.get(Account, txn.account_id)
        if account:
            if txn.type == TransactionType.expense:
                account.current_balance -= amount_delta
            elif txn.type == TransactionType.income:
                account.current_balance += amount_delta

    # If the transaction had no recurring link and the edit might now make it match, re-check
    if not had_recurring and txn.recurring_item_id is None and override != "extra_payment":
        await find_and_attach_recurring(txn, db)
    elif had_recurring:
        await update_recurring_item(txn, db)

    await db.commit()
    return await _get_or_404(txn.id, db)


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    txn = await _get_or_404(transaction_id, db)
    await _reverse_balance_and_delete(txn, db, now)
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
        if txn.deleted_at is not None:
            # Already soft-deleted as the counterpart of a transfer processed earlier
            continue
        await _reverse_balance_and_delete(txn, db, now)
    await db.commit()


async def _reverse_balance_and_delete(txn: Transaction, db: AsyncSession, now: datetime) -> None:
    """Reverse the account balance effect of a transaction and soft-delete it."""
    await detach_recurring(txn, db)

    # Cascade delete paired transaction (e.g. linked mortgage payment legs, transfer source)
    if txn.paired_transaction_id:
        paired = await db.get(Transaction, txn.paired_transaction_id)
        if paired and paired.deleted_at is None:
            paired_account = await db.get(Account, paired.account_id)
            if paired_account:
                if paired.type == TransactionType.expense:
                    paired_account.current_balance += paired.amount
                elif paired.type == TransactionType.income:
                    paired_account.current_balance -= paired.amount
                elif paired.type == TransactionType.transfer:
                    # Source leg of a transfer — was subtracted from this account
                    paired_account.current_balance += paired.amount
            paired.paired_transaction_id = None
            paired.deleted_at = now

    txn.deleted_at = now

    account = await db.get(Account, txn.account_id)
    if not account:
        return

    if txn.type == TransactionType.expense:
        account.current_balance += txn.amount
    elif txn.type == TransactionType.income:
        account.current_balance -= txn.amount
    elif txn.type == TransactionType.transfer and txn.transfer_account_id:
        is_destination = txn.paired_transaction_id is not None
        if is_destination:
            # Destination: was added to this account → subtract to reverse
            account.current_balance -= txn.amount
            # Source was already handled by the cascade above
        else:
            # Source: was subtracted from this account → add to reverse
            account.current_balance += txn.amount
            # Find and soft-delete the matching destination leg
            dest_result = await db.execute(
                select(Transaction).where(
                    Transaction.account_id == txn.transfer_account_id,
                    Transaction.transfer_account_id == txn.account_id,
                    Transaction.amount == txn.amount,
                    Transaction.date == txn.date,
                    Transaction.deleted_at == None,
                )
            )
            dest_txn = dest_result.scalar_one_or_none()
            if dest_txn:
                dest_txn.deleted_at = now
                dest_account = await db.get(Account, dest_txn.account_id)
                if dest_account:
                    dest_account.current_balance -= dest_txn.amount


async def _get_or_404(transaction_id: uuid.UUID, db: AsyncSession) -> Transaction:
    result = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.category), selectinload(Transaction.recurring_item), selectinload(Transaction.account), selectinload(Transaction.expense_account))
        .where(Transaction.id == transaction_id, Transaction.deleted_at == None)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn
