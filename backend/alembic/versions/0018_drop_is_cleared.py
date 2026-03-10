"""Drop is_cleared column from transactions

Revision ID: 0018
Revises: 0017
Create Date: 2026-03-09 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("transactions", "is_cleared")


def downgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("is_cleared", sa.Boolean(), nullable=False, server_default="false"),
    )
