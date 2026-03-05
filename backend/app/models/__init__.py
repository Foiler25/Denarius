# Import all submodules so Alembic can discover ORM models for autogenerate
from . import (  # noqa: F401
    user,
    account,
    expense_account,
    mortgage_detail,
    category,
    transaction,
    budget,
    recurring_item,
    net_worth_snapshot,
    refresh_token,
)
