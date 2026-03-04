"""Add amount_min and amount_max to recurring_items

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-03 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recurring_items", sa.Column("amount_min", sa.Numeric(15, 2), nullable=True))
    op.add_column("recurring_items", sa.Column("amount_max", sa.Numeric(15, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("recurring_items", "amount_max")
    op.drop_column("recurring_items", "amount_min")
