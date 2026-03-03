import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class MortgageCreate(BaseModel):
    original_principal: Decimal
    interest_rate: Decimal
    term_months: int
    start_date: date
    extra_payment: Decimal = Decimal("0.00")


class MortgageUpdate(BaseModel):
    original_principal: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    term_months: Optional[int] = None
    start_date: Optional[date] = None
    extra_payment: Optional[Decimal] = None


class MortgageOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    account_id: uuid.UUID
    original_principal: Decimal
    interest_rate: Decimal
    term_months: int
    start_date: date
    extra_payment: Decimal


class AmortizationRow(BaseModel):
    payment_number: int
    payment_date: date
    payment_amount: Decimal
    principal: Decimal
    interest: Decimal
    balance: Decimal
    cumulative_interest: Decimal


class ExtraPaymentCalcRequest(BaseModel):
    extra_monthly: Decimal


class ExtraPaymentCalcResult(BaseModel):
    months_saved: int
    interest_saved: Decimal
    new_payoff_date: date
