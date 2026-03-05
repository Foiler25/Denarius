import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.category import Category
from app.models.mortgage_detail import MortgageDetail
from app.models.transaction import Transaction, TransactionType
from app.models.user import User
from app.schemas.mortgage import (
    AmortizationRow,
    ExtraPaymentCalcRequest,
    ExtraPaymentCalcResult,
    MortgageCreate,
    MortgageOut,
    MortgagePaymentCreate,
    MortgagePaymentResult,
    MortgageUpdate,
)
from app.services.mortgage_service import build_amortization_schedule, calculate_extra_payment_savings

router = APIRouter(prefix="/accounts", tags=["mortgage"])


@router.post("/{account_id}/mortgage", response_model=MortgageOut, status_code=201)
async def create_mortgage(
    account_id: uuid.UUID,
    data: MortgageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = await _get_account_or_404(account_id, db)
    existing = await db.execute(
        select(MortgageDetail).where(MortgageDetail.account_id == account_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Mortgage details already exist for this account")
    mortgage = MortgageDetail(account_id=account_id, **data.model_dump())
    db.add(mortgage)
    await db.commit()
    await db.refresh(mortgage)
    return mortgage


@router.get("/{account_id}/mortgage", response_model=MortgageOut)
async def get_mortgage(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _get_mortgage_or_404(account_id, db)


@router.put("/{account_id}/mortgage", response_model=MortgageOut)
async def update_mortgage(
    account_id: uuid.UUID,
    data: MortgageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mortgage = await _get_mortgage_or_404(account_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(mortgage, field, value)
    await db.commit()
    await db.refresh(mortgage)
    return mortgage


@router.get("/{account_id}/mortgage/amortization", response_model=list[AmortizationRow])
async def get_amortization(
    account_id: uuid.UUID,
    extra_payment: Optional[Decimal] = Query(None),
    from_current_balance: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mortgage = await _get_mortgage_or_404(account_id, db)
    ep = extra_payment if extra_payment is not None else mortgage.extra_payment

    if from_current_balance:
        account = await _get_account_or_404(account_id, db)
        today = date.today()
        rd = relativedelta(today, mortgage.start_date)
        months_elapsed = rd.years * 12 + rd.months
        remaining_months = mortgage.term_months - months_elapsed
        if remaining_months <= 0:
            return []
        current_balance = abs(account.current_balance)
        if current_balance == 0:
            return []
        return build_amortization_schedule(
            current_balance,
            mortgage.interest_rate,
            remaining_months,
            today,
            ep,
        )

    return build_amortization_schedule(
        mortgage.original_principal,
        mortgage.interest_rate,
        mortgage.term_months,
        mortgage.start_date,
        ep,
    )


@router.post("/{account_id}/mortgage/extra-payment-calc", response_model=ExtraPaymentCalcResult)
async def extra_payment_calc(
    account_id: uuid.UUID,
    data: ExtraPaymentCalcRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = await _get_account_or_404(account_id, db)
    mortgage = await _get_mortgage_or_404(account_id, db)

    today = date.today()
    rd = relativedelta(today, mortgage.start_date)
    months_elapsed = rd.years * 12 + rd.months
    remaining_months = mortgage.term_months - months_elapsed
    if remaining_months <= 0:
        raise HTTPException(status_code=400, detail="Loan term has already elapsed.")

    # Use the actual current balance so the comparison starts from today's position,
    # not the original loan amount years in the past.
    current_balance = abs(account.current_balance)
    if current_balance == 0:
        raise HTTPException(status_code=400, detail="Loan balance is already zero.")

    return calculate_extra_payment_savings(
        current_balance,
        mortgage.interest_rate,
        remaining_months,
        today,
        data.extra_monthly,
    )


@router.post("/{account_id}/mortgage/record-payment", response_model=MortgagePaymentResult, status_code=201)
async def record_mortgage_payment(
    account_id: uuid.UUID,
    data: MortgagePaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create two linked transactions for a mortgage payment:
    - Source transaction: full payment amount debited from source account
    - Mortgage transaction: principal/extra amount debited from mortgage account
    Both are linked via paired_transaction_id so deleting one deletes both.
    """
    mortgage_account = await _get_account_or_404(account_id, db)
    source_result = await db.execute(
        select(Account).where(Account.id == data.source_account_id, Account.deleted_at == None)
    )
    source_account = source_result.scalar_one_or_none()
    if not source_account:
        raise HTTPException(status_code=404, detail="Source account not found")

    # Auto-find a mortgage/loan category
    cat_result = await db.execute(
        select(Category).where(
            Category.deleted_at == None,
            or_(
                func.lower(Category.name).contains("mortgage"),
                func.lower(Category.name).contains("loan"),
            ),
        ).limit(1)
    )
    category = cat_result.scalar_one_or_none()
    category_id = category.id if category else None

    now = datetime.now(timezone.utc)
    desc_source = data.description or "Mortgage payment"
    desc_mortgage = (data.description or "Mortgage payment") + " — principal"

    # Create source transaction (full payment from source account)
    source_txn = Transaction(
        account_id=data.source_account_id,
        category_id=category_id,
        amount=data.source_amount,
        type=TransactionType.expense,
        description=desc_source,
        date=data.date,
        created_by=current_user.id,
    )
    db.add(source_txn)
    source_account.current_balance -= data.source_amount

    # Create mortgage transaction (principal/extra reduction on mortgage account)
    mortgage_txn = Transaction(
        account_id=account_id,
        category_id=category_id,
        amount=data.mortgage_amount,
        type=TransactionType.expense,
        description=desc_mortgage,
        date=data.date,
        created_by=current_user.id,
    )
    db.add(mortgage_txn)
    mortgage_account.current_balance -= data.mortgage_amount

    # Flush to get IDs, then link them
    await db.flush()
    source_txn.paired_transaction_id = mortgage_txn.id
    mortgage_txn.paired_transaction_id = source_txn.id

    await db.commit()
    return MortgagePaymentResult(
        source_transaction_id=source_txn.id,
        mortgage_transaction_id=mortgage_txn.id,
    )


async def _get_account_or_404(account_id: uuid.UUID, db: AsyncSession) -> Account:
    result = await db.execute(
        select(Account).where(Account.id == account_id, Account.deleted_at == None)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def _get_mortgage_or_404(account_id: uuid.UUID, db: AsyncSession) -> MortgageDetail:
    result = await db.execute(
        select(MortgageDetail).where(MortgageDetail.account_id == account_id)
    )
    mortgage = result.scalar_one_or_none()
    if not mortgage:
        raise HTTPException(status_code=404, detail="Mortgage details not found for this account")
    return mortgage
