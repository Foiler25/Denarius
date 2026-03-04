"""Add linked_mortgage_id to accounts

Revision ID: 0009
Revises: ab86423ea886
Create Date: 2026-03-04 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "ab86423ea886"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("linked_mortgage_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_accounts_linked_mortgage",
        "accounts",
        "accounts",
        ["linked_mortgage_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_accounts_linked_mortgage", "accounts", type_="foreignkey")
    op.drop_column("accounts", "linked_mortgage_id")
