import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.schemas.category import CategoryOut


class BudgetCreate(BaseModel):
    category_id: uuid.UUID
    month: date
    amount: Decimal


class BudgetUpdate(BaseModel):
    amount: Decimal


class BudgetOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    category_id: uuid.UUID
    month: date
    amount: float
    category: Optional[CategoryOut] = None


class BudgetWithSpent(BudgetOut):
    actual_spent: float
    remaining: float
    is_over_budget: bool


class BudgetSummary(BaseModel):
    total_budgeted: float
    total_spent: float
    over_budget_categories: list[BudgetWithSpent]


class CopyMonthRequest(BaseModel):
    from_month: date
    to_month: date
