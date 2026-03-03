import logging
from app.database import AsyncSessionLocal
from app.services.networth_service import create_snapshot

logger = logging.getLogger(__name__)


async def net_worth_snapshot_job() -> None:
    async with AsyncSessionLocal() as db:
        try:
            snap = await create_snapshot(db)
            logger.info("Net worth snapshot created for %s: $%s", snap.snapshot_date, snap.net_worth)
        except Exception as e:
            logger.error("Error in net_worth_snapshot_job: %s", e)
