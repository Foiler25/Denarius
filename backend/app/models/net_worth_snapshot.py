from datetime import date
from decimal import Decimal
from sqlalchemy import Date, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDMixin, TimestampMixin


class NetWorthSnapshot(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "net_worth_snapshots"
    __table_args__ = (UniqueConstraint("snapshot_date", name="uq_snapshot_date"),)

    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_assets: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    total_liabilities: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    net_worth: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    account_breakdown: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
