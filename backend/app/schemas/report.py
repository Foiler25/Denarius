from decimal import Decimal
from pydantic import BaseModel


class SpendingByCategory(BaseModel):
    category_id: str
    category_name: str
    color: str
    total: Decimal
    percentage: float


class MonthlyIncomeExpense(BaseModel):
    month: str
    income: Decimal
    expenses: Decimal
    net: Decimal


class MonthlyTrend(BaseModel):
    month: str
    total: Decimal


class CashFlowReport(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net: Decimal
    by_month: list[MonthlyIncomeExpense]
