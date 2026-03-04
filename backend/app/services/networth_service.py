from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountType
from app.models.net_worth_snapshot import NetWorthSnapshot
from app.schemas.net_worth import AccountBreakdownItem, NetWorthCurrent

ASSET_TYPES = {
    AccountType.checking,
    AccountType.savings,
    AccountType.investment,
    AccountType.property,
}
LIABILITY_TYPES = {AccountType.credit_card, AccountType.mortgage, AccountType.loan}


async def get_current_net_worth(db: AsyncSession) -> NetWorthCurrent:
    result = await db.execute(
        select(Account).where(Account.is_active == True, Account.deleted_at == None)
    )
    accounts = result.scalars().all()

    assets = Decimal("0.00")
    liabilities = Decimal("0.00")
    breakdown = []

    for acc in accounts:
        is_asset = acc.type in ASSET_TYPES
        item = AccountBreakdownItem(
            account_id=str(acc.id),
            account_name=acc.name,
            account_type=acc.type.value,
            balance=acc.current_balance,
            is_asset=is_asset,
        )
        breakdown.append(item)
        if is_asset:
            assets += acc.current_balance
        elif acc.type in LIABILITY_TYPES:
            liabilities += acc.current_balance

    return NetWorthCurrent(
        assets=assets,
        liabilities=liabilities,
        net_worth=assets - liabilities,
        accounts=breakdown,
    )


async def create_snapshot(db: AsyncSession, snapshot_date: date | None = None) -> NetWorthSnapshot:
    if snapshot_date is None:
        snapshot_date = date.today().replace(day=1)

    current = await get_current_net_worth(db)

    existing = await db.execute(
        select(NetWorthSnapshot).where(NetWorthSnapshot.snapshot_date == snapshot_date)
    )
    snap = existing.scalar_one_or_none()

    if snap:
        snap.total_assets = current.assets
        snap.total_liabilities = current.liabilities
        snap.net_worth = current.net_worth
        snap.account_breakdown = [a.model_dump() for a in current.accounts]
    else:
        snap = NetWorthSnapshot(
            snapshot_date=snapshot_date,
            total_assets=current.assets,
            total_liabilities=current.liabilities,
            net_worth=current.net_worth,
            account_breakdown=[a.model_dump() for a in current.accounts],
        )
        db.add(snap)

    await db.commit()
    await db.refresh(snap)
    return snap
