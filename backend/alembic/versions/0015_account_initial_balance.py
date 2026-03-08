"""Add initial_balance to accounts for persistent manual balance tracking

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-07 00:00:00.000000
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: Union[str, None] = "0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column(
            "initial_balance",
            sa.Numeric(15, 2),
            nullable=False,
            server_default="0.00",
        ),
    )

    # Data migration: for each existing account, compute
    # initial_balance = current_balance - sum(all non-deleted transactions)
    # so that initial_balance + sum(transactions) == current_balance always holds.
    conn = op.get_bind()
    accounts = conn.execute(
        sa.text("SELECT id, current_balance FROM accounts WHERE deleted_at IS NULL")
    ).fetchall()

    for acct in accounts:
        txn_sum = conn.execute(
            sa.text("""
                SELECT COALESCE(SUM(
                    CASE
                        WHEN type = 'income'   THEN amount
                        WHEN type = 'expense'  THEN -amount
                        WHEN type = 'transfer' THEN -amount
                        ELSE 0
                    END
                ), 0)
                FROM transactions
                WHERE account_id = :id AND deleted_at IS NULL
            """),
            {"id": acct.id},
        ).scalar()

        initial_balance = float(acct.current_balance) - float(txn_sum)
        conn.execute(
            sa.text("UPDATE accounts SET initial_balance = :ib WHERE id = :id"),
            {"ib": initial_balance, "id": acct.id},
        )


def downgrade() -> None:
    op.drop_column("accounts", "initial_balance")
