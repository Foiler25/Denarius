import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models.recurring_item import RecurringFrequency, RecurringType


class RecurringCreate(BaseModel):
    name: str
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    amount: Decimal
    amount_min: Optional[Decimal] = None
    amount_max: Optional[Decimal] = None
    type: RecurringType
    frequency: RecurringFrequency
    day_of_month: Optional[int] = None
    next_due_date: date
    auto_post: bool = False
    auto_match: bool = False
    keyword_match: Optional[str] = None
    notes: Optional[str] = None


class RecurringUpdate(BaseModel):
    name: Optional[str] = None
    account_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = None
    amount_min: Optional[Decimal] = None
    amount_max: Optional[Decimal] = None
    frequency: Optional[RecurringFrequency] = None
    day_of_month: Optional[int] = None
    next_due_date: Optional[date] = None
    auto_post: Optional[bool] = None
    auto_match: Optional[bool] = None
    keyword_match: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class RecurringOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID]
    amount: Decimal
    amount_min: Optional[Decimal] = None
    amount_max: Optional[Decimal] = None
    type: RecurringType
    frequency: RecurringFrequency
    day_of_month: Optional[int]
    next_due_date: date
    auto_post: bool
    auto_match: bool
    keyword_match: Optional[str] = None
    is_active: bool
    notes: Optional[str]
    days_until_due: Optional[int] = None
    last_paid_date: Optional[date] = None
    last_paid_amount: Optional[Decimal] = None
    last_paid_transaction_id: Optional[uuid.UUID] = None
    is_paid_current_period: bool = False


class MarkPaidRequest(BaseModel):
    date: Optional[date] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    account_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None
