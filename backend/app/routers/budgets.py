import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.budget import (
    BudgetCreate,
    BudgetOut,
    BudgetSummary,
    BudgetUpdate,
    BudgetWithSpent,
    CopyMonthRequest,
)
from app.utils.date_utils import first_of_month

router = APIRouter(prefix="/budgets", tags=["budgets"])


async def _budgets_with_spent(month: date, db: AsyncSession) -> list[BudgetWithSpent]:
    month_start = first_of_month(month)
    if month_start.month == 12:
        month_end = month_start.replace(year=month_start.year + 1, month=1, day=1)
    else:
        month_end = month_start.replace(month=month_start.month + 1)

    result = await db.execute(
        select(Budget).options(selectinload(Budget.category))
        .where(Budget.month == month_start)
    )
    budgets = result.scalars().all()

    out = []
    for b in budgets:
        spent_result = await db.execute(
            select(func.coalesce(func.sum(Transaction.amount), Decimal("0")))
            .where(
                Transaction.category_id == b.category_id,
                Transaction.type == TransactionType.expense,
                Transaction.date >= month_start,
                Transaction.date < month_end,
                Transaction.deleted_at == None,
            )
        )
        actual_spent = spent_result.scalar() or Decimal("0")
        remaining = b.amount - actual_spent
        out.append(BudgetWithSpent(
            id=b.id,
            category_id=b.category_id,
            month=b.month,
            amount=b.amount,
            category=b.category,
            actual_spent=actual_spent,
            remaining=remaining,
            is_over_budget=actual_spent > b.amount,
        ))
    return out


@router.get("", response_model=list[BudgetWithSpent])
async def list_budgets(
    month: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today()
    return await _budgets_with_spent(target_month, db)


@router.post("", response_model=BudgetOut, status_code=201)
async def create_or_update_budget(
    data: BudgetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    month_start = first_of_month(data.month)
    existing = await db.execute(
        select(Budget).where(Budget.category_id == data.category_id, Budget.month == month_start)
    )
    budget = existing.scalar_one_or_none()
    if budget:
        budget.amount = data.amount
    else:
        budget = Budget(category_id=data.category_id, month=month_start, amount=data.amount)
        db.add(budget)
    await db.commit()
    result = await db.execute(
        select(Budget).options(selectinload(Budget.category)).where(Budget.id == budget.id)
    )
    return result.scalar_one()


@router.get("/summary", response_model=BudgetSummary)
async def budget_summary(
    month: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target_month = month or date.today()
    items = await _budgets_with_spent(target_month, db)
    total_budgeted = sum(b.amount for b in items)
    total_spent = sum(b.actual_spent for b in items)
    over_budget = [b for b in items if b.is_over_budget]
    return BudgetSummary(
        total_budgeted=total_budgeted,
        total_spent=total_spent,
        over_budget_categories=over_budget,
    )


@router.get("/{budget_id}", response_model=BudgetOut)
async def get_budget(
    budget_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_or_404(budget_id, db)


@router.put("/{budget_id}", response_model=BudgetOut)
async def update_budget(
    budget_id: uuid.UUID,
    data: BudgetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = await _get_or_404(budget_id, db)
    budget.amount = data.amount
    await db.commit()
    await db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
async def delete_budget(
    budget_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = await _get_or_404(budget_id, db)
    await db.delete(budget)
    await db.commit()


@router.post("/copy-month", response_model=list[BudgetOut])
async def copy_month(
    data: CopyMonthRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from_month = first_of_month(data.from_month)
    to_month = first_of_month(data.to_month)
    source_result = await db.execute(
        select(Budget).where(Budget.month == from_month)
    )
    sources = source_result.scalars().all()
    created = []
    for src in sources:
        existing = await db.execute(
            select(Budget).where(Budget.category_id == src.category_id, Budget.month == to_month)
        )
        b = existing.scalar_one_or_none()
        if b:
            b.amount = src.amount
        else:
            b = Budget(category_id=src.category_id, month=to_month, amount=src.amount)
            db.add(b)
        created.append(b)
    await db.commit()
    return created


async def _get_or_404(budget_id: uuid.UUID, db: AsyncSession) -> Budget:
    result = await db.execute(select(Budget).where(Budget.id == budget_id))
    b = result.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Budget not found")
    return b
