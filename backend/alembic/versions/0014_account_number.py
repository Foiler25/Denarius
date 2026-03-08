"""Add account_number to accounts

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-07 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("account_number", sa.String(4), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "account_number")
