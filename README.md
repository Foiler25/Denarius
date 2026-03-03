# Denarius

Self-hosted personal finance tracker for families. Built for deployment on Umbrel OS via Docker Compose, accessible through Tailscale.

## Features

- **Dashboard** — Net worth, monthly spending, upcoming bills, recent transactions
- **Transactions** — Manual entry, CSV export, filtering by date/category/account
- **Budgets** — Monthly per-category budgets with progress tracking
- **Recurring & Subscriptions** — Subscriptions (Netflix, Spotify), recurring bills, due date alerts, auto-posting
- **Mortgage** — Amortization schedule, extra payment calculator
- **Net Worth** — Assets vs liabilities, historical chart, monthly auto-snapshot
- **Reports** — Spending by category (pie), income vs expense (bar), monthly trends
- **Multi-user** — Family members share data; first user becomes admin
- **REST API** — Full OpenAPI documentation at `/api/docs`

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/yourusername/denarius.git
cd denarius
cp .env.example .env
```

Edit `.env` and set:
```
POSTGRES_PASSWORD=your_strong_password
JWT_SECRET=$(openssl rand -hex 32)
ALLOWED_ORIGINS=http://YOUR_TAILSCALE_IP:9723
```

### 2. Start

```bash
docker compose up -d
```

The app will be available at `http://localhost:9723`

### 3. First Login

Open the app and register your first account — it will automatically be assigned the **admin** role.

## Umbrel Installation

### Option A: docker-compose (manual)

SSH into your Umbrel server and run:

```bash
git clone https://github.com/yourusername/denarius.git ~/denarius
cd ~/denarius
cp .env.example .env
# Edit .env
docker compose up -d
```

### Option B: Umbrel Community App Store

Add the community app store URL in your Umbrel dashboard, then install Denarius from the Finance category.

## Tailscale Access

Ensure your Umbrel server is connected to your Tailscale network. Access the app at:
```
http://<tailscale-ip>:9723
```

Or set up a Tailscale MagicDNS hostname and use:
```
http://umbrel.your-tailnet.ts.net:9723
```

Update `ALLOWED_ORIGINS` in `.env` to include your Tailscale address.

## API Documentation

The REST API is documented at:
```
http://localhost:9723/api/docs
```

This is a full OpenAPI (Swagger) UI. Future iOS/mobile clients can authenticate using Bearer tokens from the `/api/v1/auth/login` endpoint.

## Backups

Backups are stored in `./backups/` as compressed SQL files (`db-YYYY-MM-DD_HH-MM-SS.sql.gz`).

### Automatic Backups
- The `backup-cron` service runs `pg_dump` daily at 02:00
- The backend also runs a backup job daily at 02:00 via APScheduler
- Backups are retained for `BACKUP_RETAIN_DAYS` days (default: 30)

### Manual Backup
```bash
# Via Docker
docker compose exec backup-cron /usr/local/bin/backup.sh

# Via API (admin)
curl -X POST http://localhost:9723/api/v1/system/backup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Restore from Backup
```bash
# List backups
ls ./backups/

# Restore
gunzip -c ./backups/db-2025-01-01_02-00-00.sql.gz | \
  docker compose exec -T postgres psql -U denarius -d denarius
```

## Development

```bash
# Start with dev overrides (hot reload)
docker compose up

# The override file enables:
# - Backend hot reload (uvicorn --reload)
# - PostgreSQL port exposed at 5432
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `denarius` | Database name |
| `POSTGRES_USER` | `denarius` | Database user |
| `POSTGRES_PASSWORD` | — | **Required.** Database password |
| `JWT_SECRET` | — | **Required.** Secret key for JWT signing (32+ chars) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | JWT access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token lifetime |
| `ENVIRONMENT` | `production` | `production` or `development` |
| `ALLOWED_ORIGINS` | `http://localhost:9723` | CORS allowed origins (comma-separated) |
| `APP_PORT` | `9723` | Host port for the web UI |
| `BACKUP_RETAIN_DAYS` | `30` | Days to keep backup files |

## Architecture

```
[Tailscale] → :9723 → nginx → /* → React SPA
                            → /api/* → FastAPI (port 8000)
                                         ↓
                                     PostgreSQL 15
backup-cron (pg_dump daily at 02:00 → ./backups/)
```

**Tech Stack:**
- Backend: Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, APScheduler
- Frontend: React 18, Vite, TypeScript, Shadcn/ui, Tailwind CSS, Recharts
- Database: PostgreSQL 15
- Proxy: Nginx
