import uuid
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    institution: Optional[str] = None
    current_balance: Decimal = Decimal("0.00")
    credit_limit: Optional[Decimal] = None
    sort_order: int = 0
    notes: Optional[str] = None


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AccountType] = None
    institution: Optional[str] = None
    current_balance: Optional[Decimal] = None
    credit_limit: Optional[Decimal] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    notes: Optional[str] = None


class AccountBalanceUpdate(BaseModel):
    balance: Decimal


class AccountOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    type: AccountType
    institution: Optional[str]
    current_balance: Decimal
    credit_limit: Optional[Decimal]
    is_active: bool
    sort_order: int
    notes: Optional[str]
