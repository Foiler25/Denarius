"""Add timezone, theme_dark, dashboard_hidden_accounts to users table

Revision ID: 0017
Revises: 0016
Create Date: 2026-03-08 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("theme_dark", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("dashboard_hidden_accounts", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "dashboard_hidden_accounts")
    op.drop_column("users", "theme_dark")
