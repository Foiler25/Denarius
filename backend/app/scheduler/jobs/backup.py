import logging
from app.services.backup_service import run_backup

logger = logging.getLogger(__name__)


async def backup_job() -> None:
    try:
        path = await run_backup()
        logger.info("Database backup completed: %s", path)
    except Exception as e:
        logger.error("Error in backup_job: %s", e)
