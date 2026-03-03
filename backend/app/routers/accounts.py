import uuid
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.account import AccountBalanceUpdate, AccountCreate, AccountOut, AccountUpdate
from app.schemas.transaction import TransactionOut
from app.utils.pagination import PagedResponse

router = APIRouter(prefix="/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Account)
        .where(Account.is_active == True, Account.deleted_at == None)
        .order_by(Account.sort_order, Account.name)
    )
    return result.scalars().all()


@router.post("", response_model=AccountOut, status_code=201)
async def create_account(
    data: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = Account(**data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = await _get_or_404(account_id, db)
    return account


@router.put("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: uuid.UUID,
    data: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = await _get_or_404(account_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=204)
async def delete_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = await _get_or_404(account_id, db)
    account.deleted_at = datetime.now(timezone.utc)
    account.is_active = False
    await db.commit()


@router.put("/{account_id}/balance", response_model=AccountOut)
async def update_balance(
    account_id: uuid.UUID,
    data: AccountBalanceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = await _get_or_404(account_id, db)
    account.current_balance = data.balance
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}/transactions", response_model=PagedResponse[TransactionOut])
async def get_account_transactions(
    account_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_or_404(account_id, db)
    offset = (page - 1) * limit
    base = select(Transaction).where(Transaction.account_id == account_id, Transaction.deleted_at == None)
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar()
    result = await db.execute(base.order_by(Transaction.date.desc()).offset(offset).limit(limit))
    items = result.scalars().all()
    return PagedResponse(items=items, total=total, page=page, pages=-(-total // limit), limit=limit)


async def _get_or_404(account_id: uuid.UUID, db: AsyncSession) -> Account:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.deleted_at == None)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account
