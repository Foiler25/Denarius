import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy import Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, UUIDMixin, TimestampMixin


class MortgageDetail(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "mortgage_details"

    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    original_principal: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(7, 5), nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    extra_payment: Mapped[Decimal] = mapped_column(
        Numeric(15, 2), nullable=False, default=Decimal("0.00")
    )
    loan_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    account: Mapped["Account"] = relationship("Account", backref="mortgage_detail", uselist=False)
