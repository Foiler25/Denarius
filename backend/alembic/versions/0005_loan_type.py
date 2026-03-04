"""Add loan_type to mortgage_details

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-03 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mortgage_details", sa.Column("loan_type", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("mortgage_details", "loan_type")
