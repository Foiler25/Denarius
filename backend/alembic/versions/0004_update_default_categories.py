"""Update default categories: remove old, add new

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-03 00:01:00.000000
"""
from typing import Sequence, Union
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REMOVE_NAMES = [
    "Internet & Phone",
    "Clothing",
    "Personal Care",
    "Childcare",
    "Travel",
    "Home Improvement",
    "Pet Care",
    "Utilities",
    "Gifts & Donations",
]

ADD_CATEGORIES = [
    # (name, type, color, icon, sort_order)
    ("Electricity", "expense", "#3B82F6", "zap",      6),
    ("Water",       "expense", "#0EA5E9", "droplets",  7),
    ("Internet",    "expense", "#8B5CF6", "wifi",      8),
    ("Phone",       "expense", "#EC4899", "phone",     9),
]


def upgrade() -> None:
    now = datetime.now(timezone.utc).isoformat()
    names_list = ", ".join(f"'{n}'" for n in REMOVE_NAMES)
    op.execute(
        f"UPDATE categories SET deleted_at = '{now}' "
        f"WHERE name IN ({names_list}) AND is_system = true AND deleted_at IS NULL"
    )

    categories_table = sa.table(
        "categories",
        sa.column("name", sa.String),
        sa.column("type", postgresql.ENUM(name="category_type", create_type=False)),
        sa.column("color", sa.String),
        sa.column("icon", sa.String),
        sa.column("is_system", sa.Boolean),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        categories_table,
        [
            {
                "name": name,
                "type": cat_type,
                "color": color,
                "icon": icon,
                "is_system": True,
                "sort_order": sort_order,
            }
            for name, cat_type, color, icon, sort_order in ADD_CATEGORIES
        ],
    )


def downgrade() -> None:
    # Re-soft-delete the added categories
    add_names = ", ".join(f"'{n}'" for n, *_ in ADD_CATEGORIES)
    now = datetime.now(timezone.utc).isoformat()
    op.execute(
        f"UPDATE categories SET deleted_at = '{now}' "
        f"WHERE name IN ({add_names}) AND is_system = true AND deleted_at IS NULL"
    )
    # Restore the removed categories
    remove_names = ", ".join(f"'{n}'" for n in REMOVE_NAMES)
    op.execute(
        f"UPDATE categories SET deleted_at = NULL "
        f"WHERE name IN ({remove_names}) AND is_system = true"
    )
