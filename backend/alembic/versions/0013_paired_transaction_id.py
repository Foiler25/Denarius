"""Add paired_transaction_id to transactions for linked mortgage payment pairs

Revision ID: 0013
Revises: 2cb82bafb25a
Create Date: 2026-03-04 12:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "2cb82bafb25a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("paired_transaction_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_paired_transaction_id",
        "transactions",
        "transactions",
        ["paired_transaction_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_paired_transaction_id", "transactions", type_="foreignkey")
    op.drop_column("transactions", "paired_transaction_id")
