"""Set paired_transaction_id on existing transfer pairs and recalculate initial_balance

Revision ID: 0022
Revises: 0021
Create Date: 2026-03-17 00:00:00.000000
"""
from decimal import Decimal
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Step 1: Find all transfer pairs and set paired_transaction_id on one leg.
    # For each pair, the leg with the alphabetically greater UUID becomes the
    # "destination" (paired_transaction_id points to the other leg).
    pairs = conn.execute(
        sa.text("""
            SELECT a.id AS source_id, b.id AS dest_id
            FROM transactions a
            JOIN transactions b
              ON a.account_id = b.transfer_account_id
             AND a.transfer_account_id = b.account_id
             AND a.amount = b.amount
             AND a.date = b.date
             AND a.type = 'transfer'
             AND b.type = 'transfer'
             AND a.deleted_at IS NULL
             AND b.deleted_at IS NULL
             AND a.paired_transaction_id IS NULL
             AND b.paired_transaction_id IS NULL
             AND a.id::text < b.id::text
        """)
    ).fetchall()

    for source_id, dest_id in pairs:
        conn.execute(
            sa.text(
                "UPDATE transactions SET paired_transaction_id = :source_id WHERE id = :dest_id"
            ),
            {"source_id": source_id, "dest_id": dest_id},
        )

    # Step 2: Recalculate initial_balance for all accounts that have transfer
    # transactions, using the corrected sign convention.
    accounts_with_transfers = conn.execute(
        sa.text("""
            SELECT DISTINCT t.account_id
            FROM transactions t
            WHERE t.type = 'transfer'
              AND t.deleted_at IS NULL
        """)
    ).fetchall()

    for (account_id,) in accounts_with_transfers:
        # Compute corrected transaction sum:
        # income → +amount, expense → -amount,
        # transfer with paired_transaction_id (dest) → +amount,
        # transfer without (source) → -amount
        row = conn.execute(
            sa.text("""
                SELECT COALESCE(SUM(
                    CASE
                        WHEN type = 'income' THEN amount
                        WHEN type = 'expense' THEN -amount
                        WHEN type = 'transfer' AND paired_transaction_id IS NOT NULL THEN amount
                        WHEN type = 'transfer' THEN -amount
                        ELSE 0
                    END
                ), 0) AS txn_sum
                FROM transactions
                WHERE account_id = :account_id
                  AND deleted_at IS NULL
            """),
            {"account_id": account_id},
        ).fetchone()

        txn_sum = row[0]

        # Preserve current_balance (ground truth), recalculate initial_balance
        conn.execute(
            sa.text("""
                UPDATE accounts
                SET initial_balance = current_balance - :txn_sum
                WHERE id = :account_id
            """),
            {"txn_sum": txn_sum, "account_id": account_id},
        )


def downgrade():
    conn = op.get_bind()
    # Unset paired_transaction_id on transfer destination legs
    conn.execute(
        sa.text("""
            UPDATE transactions
            SET paired_transaction_id = NULL
            WHERE type = 'transfer'
              AND paired_transaction_id IS NOT NULL
              AND deleted_at IS NULL
        """)
    )
