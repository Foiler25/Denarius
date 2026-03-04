"""Add auto_match and keyword_match to recurring_items

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-03 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("recurring_items", sa.Column("auto_match", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("recurring_items", sa.Column("keyword_match", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("recurring_items", "keyword_match")
    op.drop_column("recurring_items", "auto_match")
