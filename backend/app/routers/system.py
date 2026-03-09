from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db, require_admin
from app.models.app_setting import AppSetting
from app.models.user import User
from app.scheduler.setup import scheduler
from app.services.backup_service import list_backups, run_backup

router = APIRouter(prefix="/system", tags=["system"])

_TZ_KEY = "timezone"


async def get_app_date(db: AsyncSession) -> date:
    """Return today's date in the app-configured timezone."""
    row = await db.scalar(select(AppSetting).where(AppSetting.key == _TZ_KEY))
    tz_str = row.value if row else "UTC"
    try:
        tz = ZoneInfo(tz_str)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")
    return datetime.now(tz).date()


class TimezoneUpdate(BaseModel):
    timezone: str


@router.get("/timezone")
async def get_timezone(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    row = await db.scalar(select(AppSetting).where(AppSetting.key == _TZ_KEY))
    return {"timezone": row.value if row else None}


@router.put("/timezone")
async def set_timezone(
    data: TimezoneUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = await db.scalar(select(AppSetting).where(AppSetting.key == _TZ_KEY))
    if row:
        row.value = data.timezone
    else:
        db.add(AppSetting(key=_TZ_KEY, value=data.timezone))
    await db.commit()
    return {"timezone": data.timezone}


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:
        db_status = "error"
    return {"status": "ok", "db": db_status}


@router.get("/backups")
async def get_backups(admin: User = Depends(require_admin)):
    return list_backups()


@router.post("/backup")
async def trigger_backup(admin: User = Depends(require_admin)):
    path = await run_backup()
    return {"message": "Backup completed", "path": path}


@router.get("/jobs")
async def get_jobs(admin: User = Depends(require_admin)):
    jobs = scheduler.get_jobs()
    return [
        {
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
        }
        for job in jobs
    ]
