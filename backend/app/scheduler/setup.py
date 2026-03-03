import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def register_jobs() -> None:
    from app.scheduler.jobs.auto_post_recurring import auto_post_recurring_job
    from app.scheduler.jobs.net_worth_snapshot import net_worth_snapshot_job
    from app.scheduler.jobs.backup import backup_job

    scheduler.add_job(
        auto_post_recurring_job,
        CronTrigger(hour=0, minute=5),
        id="auto_post_recurring",
        name="Auto-post due recurring items",
        replace_existing=True,
    )
    scheduler.add_job(
        net_worth_snapshot_job,
        CronTrigger(day=1, hour=1, minute=0),
        id="net_worth_snapshot",
        name="Monthly net worth snapshot",
        replace_existing=True,
    )
    scheduler.add_job(
        backup_job,
        CronTrigger(hour=2, minute=0),
        id="backup",
        name="Daily database backup",
        replace_existing=True,
    )


async def start_scheduler() -> None:
    register_jobs()
    scheduler.start()
    logger.info("APScheduler started with %d jobs", len(scheduler.get_jobs()))


async def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
    logger.info("APScheduler stopped")
