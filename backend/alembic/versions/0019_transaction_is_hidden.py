"""Add is_hidden to transactions

Revision ID: 0019
Revises: 0018
Create Date: 2026-03-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("transactions", sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default="false"))


def downgrade():
    op.drop_column("transactions", "is_hidden")
