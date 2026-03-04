import uuid
from typing import Optional
from pydantic import BaseModel
from app.models.category import CategoryType


class CategoryCreate(BaseModel):
    name: str
    type: CategoryType
    color: str = "#6B7280"
    icon: Optional[str] = None
    sort_order: int = 0
    once_per_month: bool = False


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None
    once_per_month: Optional[bool] = None


class CategoryOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    type: CategoryType
    color: str
    icon: Optional[str]
    is_system: bool
    sort_order: int
    once_per_month: bool
