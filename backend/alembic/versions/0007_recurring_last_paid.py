"""Add last_paid tracking to recurring_items

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-03 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recurring_items", sa.Column("last_paid_date", sa.Date(), nullable=True))
    op.add_column("recurring_items", sa.Column("last_paid_amount", sa.Numeric(15, 2), nullable=True))
    op.add_column("recurring_items", sa.Column("last_paid_transaction_id", postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column("recurring_items", "last_paid_transaction_id")
    op.drop_column("recurring_items", "last_paid_amount")
    op.drop_column("recurring_items", "last_paid_date")
