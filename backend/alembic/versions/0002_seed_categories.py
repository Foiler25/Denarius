"""Seed default categories

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-01 00:01:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CATEGORIES = [
    # (name, type, color, icon, sort_order)
    # Expense categories
    ("Housing",            "expense", "#EF4444", "home",              1),
    ("Groceries",          "expense", "#F97316", "shopping-cart",     2),
    ("Dining Out",         "expense", "#EAB308", "utensils",          3),
    ("Transportation",     "expense", "#22C55E", "car",               4),
    ("Gas",                "expense", "#14B8A6", "fuel",              5),
    ("Electricity",        "expense", "#3B82F6", "zap",               6),
    ("Water",              "expense", "#0EA5E9", "droplets",          7),
    ("Internet",           "expense", "#8B5CF6", "wifi",              8),
    ("Phone",              "expense", "#EC4899", "phone",             9),
    ("Health & Medical",   "expense", "#EC4899", "heart",             10),
    ("Entertainment",      "expense", "#F59E0B", "tv",                11),
    ("Streaming Services", "expense", "#6366F1", "play",              12),
    ("Education",          "expense", "#D946EF", "book",              13),
    ("Auto Insurance",     "expense", "#64748B", "shield",            14),
    ("Miscellaneous",      "expense", "#6B7280", "more-horizontal",   15),
    # Income categories
    ("Salary / Wages",     "income",  "#22C55E", "briefcase",         1),
    ("Freelance Income",   "income",  "#10B981", "laptop",            2),
    ("Investment Returns", "income",  "#3B82F6", "trending-up",       3),
    ("Tax Refund",         "income",  "#8B5CF6", "file-text",         4),
    ("Other Income",       "income",  "#6B7280", "dollar-sign",       5),
    # Transfer
    ("Account Transfer",   "transfer","#94A3B8", "arrow-right-left",  1),
]


def upgrade() -> None:
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
            for name, cat_type, color, icon, sort_order in CATEGORIES
        ],
    )


def downgrade() -> None:
    op.execute("DELETE FROM categories WHERE is_system = true")
