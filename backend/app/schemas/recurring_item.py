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
    type: RecurringType
    frequency: RecurringFrequency
    day_of_month: Optional[int] = None
    next_due_date: date
    auto_post: bool = False
    notes: Optional[str] = None


class RecurringUpdate(BaseModel):
    name: Optional[str] = None
    account_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = None
    frequency: Optional[RecurringFrequency] = None
    day_of_month: Optional[int] = None
    next_due_date: Optional[date] = None
    auto_post: Optional[bool] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class RecurringOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID]
    amount: Decimal
    type: RecurringType
    frequency: RecurringFrequency
    day_of_month: Optional[int]
    next_due_date: date
    auto_post: bool
    is_active: bool
    notes: Optional[str]
    days_until_due: Optional[int] = None


class MarkPaidRequest(BaseModel):
    date: Optional[date] = None
    amount: Optional[Decimal] = None
