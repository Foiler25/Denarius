from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, require_admin, get_db
from app.models.net_worth_snapshot import NetWorthSnapshot
from app.models.user import User
from app.schemas.net_worth import NetWorthCurrent, NetWorthSnapshotOut
from app.services.networth_service import create_snapshot, get_current_net_worth

router = APIRouter(prefix="/networth", tags=["net worth"])


@router.get("/current", response_model=NetWorthCurrent)
async def current_net_worth(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_current_net_worth(db)


@router.get("/history", response_model=list[NetWorthSnapshotOut])
async def net_worth_history(
    months: int = Query(12, ge=1, le=60),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NetWorthSnapshot)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(months)
    )
    snapshots = result.scalars().all()
    return list(reversed(snapshots))


@router.post("/snapshot", response_model=NetWorthSnapshotOut)
async def manual_snapshot(
    snapshot_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    snap = await create_snapshot(db, snapshot_date)
    return snap
