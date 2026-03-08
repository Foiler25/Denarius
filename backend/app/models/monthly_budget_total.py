from datetime import date
from decimal import Decimal
from sqlalchemy import Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class MonthlyBudgetTotal(Base):
    __tablename__ = "monthly_budget_total"

    month: Mapped[date] = mapped_column(Date, primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
