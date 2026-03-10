"""Add expense_account_id to recurring_items

Revision ID: 0020
Revises: 0019
Create Date: 2026-03-10 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "recurring_items",
        sa.Column("expense_account_id", UUID(as_uuid=True), sa.ForeignKey("expense_accounts.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade():
    op.drop_column("recurring_items", "expense_account_id")
