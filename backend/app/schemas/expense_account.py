import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ExpenseAccountCreate(BaseModel):
    name: str
    color: str = "#6B7280"
    sort_order: int = 0


class ExpenseAccountUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ExpenseAccountOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    color: str
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
