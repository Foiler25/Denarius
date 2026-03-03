import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.models.transaction import TransactionType
from app.schemas.category import CategoryOut


class TransactionCreate(BaseModel):
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID] = None
    transfer_account_id: Optional[uuid.UUID] = None
    amount: Decimal
    type: TransactionType
    description: Optional[str] = None
    notes: Optional[str] = None
    date: date
    is_cleared: bool = False


class TransactionUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[date] = None
    is_cleared: Optional[bool] = None


class TransactionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    account_id: uuid.UUID
    category_id: Optional[uuid.UUID]
    transfer_account_id: Optional[uuid.UUID]
    recurring_item_id: Optional[uuid.UUID]
    amount: Decimal
    type: TransactionType
    description: Optional[str]
    notes: Optional[str]
    date: date
    is_cleared: bool
    category: Optional[CategoryOut] = None


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]
