import uuid
from datetime import date
from decimal import Decimal
from typing import Any
from pydantic import BaseModel


class AccountBreakdownItem(BaseModel):
    account_id: str
    account_name: str
    account_type: str
    balance: Decimal
    is_asset: bool


class NetWorthCurrent(BaseModel):
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal
    accounts: list[AccountBreakdownItem]


class NetWorthSnapshotOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    snapshot_date: date
    total_assets: Decimal
    total_liabilities: Decimal
    net_worth: Decimal
    account_breakdown: list[Any]
