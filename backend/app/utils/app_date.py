from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app_setting import AppSetting

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
