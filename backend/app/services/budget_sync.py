import uuid
from datetime import date
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting
from app.models.budget import Budget
from app.models.monthly_budget_total import MonthlyBudgetTotal
from app.utils.date_utils import first_of_month

KEEP_PREF_KEY = "keep_for_next_month"


def next_month(month: date) -> date:
    return first_of_month(month) + relativedelta(months=1)


async def is_keep_enabled(db: AsyncSession) -> bool:
    row = await db.scalar(select(AppSetting).where(AppSetting.key == KEEP_PREF_KEY))
    return row.value == "true" if row else False


async def get_current_month(db: AsyncSession) -> date:
    from app.routers.system import get_app_date

    return first_of_month(await get_app_date(db))


async def is_current_month(db: AsyncSession, month: date) -> bool:
    return first_of_month(month) == await get_current_month(db)


async def upsert_category_budget(
    db: AsyncSession, *, category_id: uuid.UUID, month: date, amount: Decimal
) -> None:
    month_start = first_of_month(month)
    existing = await db.scalar(
        select(Budget).where(
            Budget.category_id == category_id, Budget.month == month_start
        )
    )
    if existing:
        existing.amount = amount
    else:
        db.add(Budget(category_id=category_id, month=month_start, amount=amount))


async def delete_category_budget(
    db: AsyncSession, *, category_id: uuid.UUID, month: date
) -> None:
    month_start = first_of_month(month)
    existing = await db.scalar(
        select(Budget).where(
            Budget.category_id == category_id, Budget.month == month_start
        )
    )
    if existing:
        await db.delete(existing)


async def upsert_monthly_total(
    db: AsyncSession, *, month: date, amount: Decimal
) -> None:
    month_start = first_of_month(month)
    existing = await db.scalar(
        select(MonthlyBudgetTotal).where(MonthlyBudgetTotal.month == month_start)
    )
    if existing:
        existing.amount = amount
    else:
        db.add(MonthlyBudgetTotal(month=month_start, amount=amount))


async def delete_monthly_total(db: AsyncSession, *, month: date) -> None:
    month_start = first_of_month(month)
    existing = await db.scalar(
        select(MonthlyBudgetTotal).where(MonthlyBudgetTotal.month == month_start)
    )
    if existing:
        await db.delete(existing)


async def mirror_current_to_next(db: AsyncSession) -> None:
    """Strict mirror: next month becomes an exact replica of current month.

    Wipes any existing next-month budgets and total, then re-inserts from current.
    Caller commits.
    """
    current = await get_current_month(db)
    nxt = next_month(current)

    await db.execute(delete(Budget).where(Budget.month == nxt))
    await db.execute(delete(MonthlyBudgetTotal).where(MonthlyBudgetTotal.month == nxt))
    await db.flush()

    sources = (
        await db.execute(select(Budget).where(Budget.month == current))
    ).scalars().all()
    for src in sources:
        db.add(Budget(category_id=src.category_id, month=nxt, amount=src.amount))

    src_total = await db.scalar(
        select(MonthlyBudgetTotal).where(MonthlyBudgetTotal.month == current)
    )
    if src_total:
        db.add(MonthlyBudgetTotal(month=nxt, amount=src_total.amount))


async def clear_next_month(db: AsyncSession) -> None:
    """Delete all per-category budgets and the monthly total for next month.

    Caller commits.
    """
    current = await get_current_month(db)
    nxt = next_month(current)
    await db.execute(delete(Budget).where(Budget.month == nxt))
    await db.execute(delete(MonthlyBudgetTotal).where(MonthlyBudgetTotal.month == nxt))
