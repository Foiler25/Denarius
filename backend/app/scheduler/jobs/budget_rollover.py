import logging
from app.database import AsyncSessionLocal
from app.services.budget_sync import is_keep_enabled, mirror_current_to_next

logger = logging.getLogger(__name__)


async def budget_rollover_job() -> None:
    async with AsyncSessionLocal() as db:
        try:
            if await is_keep_enabled(db):
                await mirror_current_to_next(db)
                await db.commit()
                logger.info("Budget rollover: mirrored current month to next")
        except Exception as e:
            logger.error("Error in budget_rollover_job: %s", e)
