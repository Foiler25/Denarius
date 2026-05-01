"""Add partial unique index enforcing at most one active admin

Closes a TOCTOU race where two simultaneous /auth/register calls could both
observe an empty users table and both be created with role='admin'. The
partial index pushes the invariant to Postgres.

Revision ID: 0023
Revises: 0022
Create Date: 2026-05-01 00:00:00.000000
"""
from alembic import op


revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade():
    # Postgres rejects `role::text` in an index expression because the enum_out
    # cast is only STABLE, not IMMUTABLE. Index on the enum column itself —
    # equality on the literal value is fine in the WHERE clause.
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS one_admin_idx
        ON users (role)
        WHERE role = 'admin' AND deleted_at IS NULL
        """
    )


def downgrade():
    op.execute("DROP INDEX IF EXISTS one_admin_idx")
