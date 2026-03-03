import logging
from app.database import AsyncSessionLocal
from app.services.recurring_service import auto_post_due_items

logger = logging.getLogger(__name__)


async def auto_post_recurring_job() -> None:
    async with AsyncSessionLocal() as db:
        try:
            posted = await auto_post_due_items(db)
            logger.info("Auto-posted %d recurring items", posted)
        except Exception as e:
            logger.error("Error in auto_post_recurring_job: %s", e)
