from decimal import Decimal
from pydantic import BaseModel
from app.schemas.net_worth import NetWorthCurrent
from app.schemas.recurring_item import RecurringOut
from app.schemas.transaction import TransactionOut
from app.schemas.budget import BudgetWithSpent


class MonthlySpendingSummary(BaseModel):
    current_month: Decimal
    prev_month: Decimal
    budget_total: Decimal
    current_month_income: Decimal


class DashboardSummary(BaseModel):
    net_worth: NetWorthCurrent
    monthly_spending: MonthlySpendingSummary
    upcoming_bills: list[RecurringOut]
    recent_transactions: list[TransactionOut]
    over_budget_alerts: list[BudgetWithSpent]
