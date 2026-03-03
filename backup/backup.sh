#!/bin/sh
set -e

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="/backups/db-${TIMESTAMP}.sql.gz"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"

echo "[$(date)] Starting backup to ${BACKUP_FILE}"

pg_dump \
  -h "${POSTGRES_HOST:-postgres}" \
  -U "${POSTGRES_USER:-denarius}" \
  -d "${POSTGRES_DB:-denarius}" \
  --no-password \
  | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup complete: ${BACKUP_FILE} ($(du -sh "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than RETAIN_DAYS
echo "[$(date)] Pruning backups older than ${RETAIN_DAYS} days"
find /backups -name "db-*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
echo "[$(date)] Pruning complete"
