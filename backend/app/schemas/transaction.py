import uuid
from datetime import date
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel
from app.models.transaction import TransactionType
from app.schemas.category import CategoryOut


class RecurringItemRef(BaseModel):
    model_config = {"from_attributes": True}
    type: str


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    transfer_account_id: Optional[uuid.UUID] = None
    expense_account_id: Optional[uuid.UUID] = None
    amount: Decimal
    type: TransactionType
    description: Optional[str] = None
    notes: Optional[str] = None
    date: date
    is_cleared: bool = False
    once_per_month_override: Optional[Literal["extra_payment", "next_month_payment"]] = None


# Alias to avoid Python naming conflict: the field name 'date' would shadow
# the 'date' type from datetime when the field has a default of None.
_Date = date


class TransactionUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    expense_account_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[_Date] = None
    is_cleared: Optional[bool] = None
    once_per_month_override: Optional[Literal["extra_payment", "next_month_payment"]] = None


class TransactionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID]
    transfer_account_id: Optional[uuid.UUID]
    recurring_item_id: Optional[uuid.UUID]
    expense_account_id: Optional[uuid.UUID] = None
    paired_transaction_id: Optional[uuid.UUID] = None
    amount: Decimal
    type: TransactionType
    description: Optional[str]
    notes: Optional[str]
    date: date
    is_cleared: bool
    category: Optional[CategoryOut] = None
    recurring_item: Optional[RecurringItemRef] = None
    account_name: Optional[str] = None
    account_color: Optional[str] = None
    expense_account_name: Optional[str] = None
    expense_account_color: Optional[str] = None


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]
