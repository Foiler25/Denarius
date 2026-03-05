import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.expense_account import ExpenseAccount
from app.models.user import User
from app.schemas.expense_account import ExpenseAccountCreate, ExpenseAccountOut, ExpenseAccountUpdate

router = APIRouter(prefix="/expense-accounts", tags=["expense-accounts"])


@router.get("", response_model=list[ExpenseAccountOut])
async def list_expense_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExpenseAccount)
        .where(ExpenseAccount.is_active == True, ExpenseAccount.deleted_at == None)
        .order_by(ExpenseAccount.sort_order, ExpenseAccount.name)
    )
    return result.scalars().all()


@router.post("", response_model=ExpenseAccountOut, status_code=201)
async def create_expense_account(
    data: ExpenseAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ea = ExpenseAccount(**data.model_dump())
    db.add(ea)
    await db.commit()
    await db.refresh(ea)
    return ea


@router.get("/{expense_account_id}", response_model=ExpenseAccountOut)
async def get_expense_account(
    expense_account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_or_404(expense_account_id, db)


@router.put("/{expense_account_id}", response_model=ExpenseAccountOut)
async def update_expense_account(
    expense_account_id: uuid.UUID,
    data: ExpenseAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ea = await _get_or_404(expense_account_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ea, field, value)
    await db.commit()
    await db.refresh(ea)
    return ea


@router.delete("/{expense_account_id}", status_code=204)
async def delete_expense_account(
    expense_account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ea = await _get_or_404(expense_account_id, db)
    ea.deleted_at = datetime.now(timezone.utc)
    ea.is_active = False
    await db.commit()


async def _get_or_404(expense_account_id: uuid.UUID, db: AsyncSession) -> ExpenseAccount:
    result = await db.execute(
        select(ExpenseAccount).where(
            ExpenseAccount.id == expense_account_id,
            ExpenseAccount.deleted_at == None,
        )
    )
    ea = result.scalar_one_or_none()
    if not ea:
        raise HTTPException(status_code=404, detail="Expense account not found")
    return ea
