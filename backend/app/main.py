import logging
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    auth, accounts, expense_accounts, mortgage, transactions, categories,
    budgets, recurring, networth, reports, dashboard, users, system,
)
from app.routers import export as export_router_module
from app.scheduler.setup import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()


def run_migrations() -> None:
    logger.info("Running Alembic migrations...")
    result = subprocess.run(
        ["alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        logger.error("Migration failed: %s", result.stderr)
        raise RuntimeError(f"Alembic migration failed: {result.stderr}")
    logger.info("Migrations complete")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    await start_scheduler()
    yield
    await stop_scheduler()


app = FastAPI(
    title="Denarius",
    description="Self-hosted personal finance tracker API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(accounts.router, prefix=PREFIX)
app.include_router(expense_accounts.router, prefix=PREFIX)
app.include_router(mortgage.router, prefix=PREFIX)
app.include_router(transactions.router, prefix=PREFIX)
app.include_router(categories.router, prefix=PREFIX)
app.include_router(budgets.router, prefix=PREFIX)
app.include_router(recurring.router, prefix=PREFIX)
app.include_router(networth.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(dashboard.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(system.router, prefix=PREFIX)
app.include_router(export_router_module.router, prefix=PREFIX)
