from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from app.models.user import User
from app.scheduler.setup import scheduler
from app.services.backup_service import list_backups, run_backup

router = APIRouter(prefix="/system", tags=["system"])


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
