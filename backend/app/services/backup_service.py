import asyncio
import gzip
import os
from datetime import datetime, timezone
from pathlib import Path

from app.config import get_settings

settings = get_settings()

BACKUP_DIR = Path("/app/backups")


async def run_backup() -> str:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    backup_file = BACKUP_DIR / f"db-{timestamp}.sql.gz"

    pg_password = settings.POSTGRES_PASSWORD or ""
    pg_user = settings.POSTGRES_USER or "denarius"
    pg_db = settings.POSTGRES_DB or "denarius"
    pg_host = settings.POSTGRES_HOST

    env = {**os.environ, "PGPASSWORD": pg_password}
    cmd = ["pg_dump", "-h", pg_host, "-U", pg_user, "-d", pg_db, "--no-password"]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env,
    )
    stdout, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"pg_dump failed: {stderr.decode()}")

    with gzip.open(backup_file, "wb") as f:
        f.write(stdout)

    _prune_old_backups()
    return str(backup_file)


def _prune_old_backups() -> None:
    retain_days = settings.BACKUP_RETAIN_DAYS
    now = datetime.now(timezone.utc).timestamp()
    cutoff = now - (retain_days * 86400)
    for f in BACKUP_DIR.glob("db-*.sql.gz"):
        if f.stat().st_mtime < cutoff:
            f.unlink()


def list_backups() -> list[dict]:
    if not BACKUP_DIR.exists():
        return []
    files = sorted(BACKUP_DIR.glob("db-*.sql.gz"), reverse=True)
    return [
        {
            "filename": f.name,
            "size_bytes": f.stat().st_size,
            "created_at": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
        }
        for f in files
    ]
