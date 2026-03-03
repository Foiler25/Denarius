import uuid
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.account import Account
from app.models.mortgage_detail import MortgageDetail
from app.models.user import User
from app.schemas.mortgage import (
    AmortizationRow,
    ExtraPaymentCalcRequest,
    ExtraPaymentCalcResult,
    MortgageCreate,
    MortgageOut,
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mortgage = await _get_mortgage_or_404(account_id, db)
    ep = extra_payment if extra_payment is not None else mortgage.extra_payment
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
    mortgage = await _get_mortgage_or_404(account_id, db)
    return calculate_extra_payment_savings(
        mortgage.original_principal,
        mortgage.interest_rate,
        mortgage.term_months,
        mortgage.start_date,
        data.extra_monthly,
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
