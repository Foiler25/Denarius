import uuid
from collections import defaultdict
from decimal import Decimal
from typing import Optional
from datetime import date, datetime, timezone

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.routers.system import get_app_date
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
    account_data = data.model_dump()
    # On creation there are no transactions yet, so initial_balance equals current_balance
    account_data["initial_balance"] = account_data["current_balance"]
    account = Account(**account_data)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/balance-history")
async def get_balance_history(
    days: int = Query(365, ge=7, le=730),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import timedelta

    today = await get_app_date(db)

    # ≤90 days → daily granularity; >90 days → monthly (approximate months from days)
    if days <= 90:
        granularity = "daily"
        date_points = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
        labels = [d.strftime("%Y-%m-%d") for d in date_points]
        oldest_cutoff = date_points[0]
    else:
        granularity = "monthly"
        approx_months = max(1, round(days / 30))
        current_month_start = today.replace(day=1)
        month_starts = [current_month_start - relativedelta(months=i) for i in range(approx_months - 1, -1, -1)]
        # Use last day of each month as the date point (today for the current month)
        date_points = []
        for i, ms in enumerate(month_starts):
            if i == len(month_starts) - 1:
                date_points.append(today)
            else:
                date_points.append(month_starts[i + 1] - timedelta(days=1))
        labels = [ms.strftime("%Y-%m") for ms in month_starts]
        oldest_cutoff = month_starts[0]

    acct_result = await db.execute(
        select(Account)
        .where(Account.is_active == True, Account.deleted_at == None)
        .order_by(Account.sort_order, Account.name)
    )
    accounts = acct_result.scalars().all()

    if not accounts:
        return {"granularity": granularity, "dates": [], "accounts": []}

    account_ids = [a.id for a in accounts]

    txn_result = await db.execute(
        select(Transaction.account_id, Transaction.amount, Transaction.type, Transaction.date)
        .where(
            Transaction.deleted_at == None,
            Transaction.date >= oldest_cutoff,
            Transaction.account_id.in_(account_ids),
        )
    )
    transactions = txn_result.all()

    txns_by_account: dict = defaultdict(list)
    for txn in transactions:
        txns_by_account[txn.account_id].append(txn)

    result_accounts = []
    for account in accounts:
        account_txns = txns_by_account.get(account.id, [])
        current_bal = float(account.current_balance)

        balances = []
        for date_point in date_points:
            adjustment = 0.0
            for txn in account_txns:
                if txn.date > date_point:
                    if txn.type == TransactionType.income:
                        adjustment -= float(txn.amount)
                    else:
                        adjustment += float(txn.amount)
            balances.append(round(current_bal + adjustment, 2))

        result_accounts.append({
            "id": str(account.id),
            "name": account.name,
            "type": account.type,
            "color": account.color,
            "balances": balances,
        })

    return {
        "granularity": granularity,
        "dates": labels,
        "accounts": result_accounts,
    }


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
    updates = data.model_dump(exclude_unset=True)
    if "current_balance" in updates:
        await _create_balance_adjustment(
            account, Decimal(str(updates.pop("current_balance"))), current_user.id, db
        )
    for field, value in updates.items():
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

    # Block deletion of a property that still has a linked mortgage
    if account.linked_mortgage_id is not None:
        raise HTTPException(
            status_code=409,
            detail="This property has a linked mortgage. Unlink it first before deleting.",
        )

    # Block deletion of a mortgage that a property is still linked to
    linked_result = await db.execute(
        select(Account).where(
            Account.linked_mortgage_id == account_id,
            Account.deleted_at == None,
        )
    )
    if linked_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="This mortgage is linked to a property. Unlink it first before deleting.",
        )

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
    await _create_balance_adjustment(account, data.balance, current_user.id, db)
    await db.commit()
    await db.refresh(account)
    return account


@router.post("/{account_id}/recalculate", response_model=AccountOut)
async def recalculate_balance(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recompute current_balance from initial_balance + sum(transactions).
    Use this to recover from any balance drift or data corruption."""
    account = await _get_or_404(account_id, db)
    txn_sum = await _get_transaction_sum(account_id, db)
    account.current_balance = account.initial_balance + txn_sum
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
    base = select(Transaction).where(Transaction.account_id == account_id, Transaction.deleted_at == None, Transaction.is_hidden != True)
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


async def _create_balance_adjustment(
    account: Account, desired_balance: Decimal, user_id: uuid.UUID, db: AsyncSession
) -> None:
    """Create a hidden adjustment transaction to reconcile account balance."""
    delta = desired_balance - account.current_balance
    if delta == 0:
        return
    today = await get_app_date(db)
    txn_type = TransactionType.income if delta > 0 else TransactionType.expense
    adjustment_txn = Transaction(
        account_id=account.id,
        amount=abs(delta),
        type=txn_type,
        is_hidden=True,
        description="Balance adjustment",
        date=today,
        created_by=user_id,
    )
    db.add(adjustment_txn)
    account.current_balance = desired_balance


async def _get_transaction_sum(account_id: uuid.UUID, db: AsyncSession) -> Decimal:
    """Sum all non-deleted transactions for an account: income → +amount, else → -amount."""
    result = await db.execute(
        select(
            func.coalesce(
                func.sum(
                    case(
                        (Transaction.type == TransactionType.income, Transaction.amount),
                        else_=-Transaction.amount,
                    )
                ),
                Decimal("0"),
            )
        ).where(
            Transaction.account_id == account_id,
            Transaction.deleted_at == None,
        )
    )
    return result.scalar() or Decimal("0")
