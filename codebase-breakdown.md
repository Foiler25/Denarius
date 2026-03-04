# Codebase Breakdown

This document provides a detailed breakdown of the Denarius codebase.

## Backend

The backend is a FastAPI application written in Python.

### Project Structure

-   `alembic/`: Contains Alembic database migration scripts.
-   `app/`: The main application directory.
    -   `main.py`: The entry point of the FastAPI application. It initializes the app, includes routers, and runs database migrations.
    -   `database.py`: Handles database connection and session management.
    -   `config.py`: Manages application settings.
    -   `dependencies.py`: FastAPI dependencies.
    -   `models/`: SQLAlchemy database models.
        -   `account.py`: Account model.
        -   `budget.py`: Budget model.
        -   `category.py`: Category model.
        -   `mortgage_detail.py`: Mortgage detail model.
        -   `net_worth_snapshot.py`: Net worth snapshot model.
        -   `recurring_item.py`: Recurring item model.
        -   `transaction.py`: Transaction model.
        -   `user.py`: User model.
        -   `refresh_token.py`: Refresh token model.
    -   `routers/`: API endpoints (routes). Each file corresponds to a feature.
        -   `accounts.py`: Account related endpoints.
        -   `auth.py`: Authentication endpoints.
        -   `budgets.py`: Budget related endpoints.
        -   `categories.py`: Category related endpoints.
        -   `dashboard.py`: Dashboard data endpoints.
        -   `mortgage.py`: Mortgage related endpoints.
        -   `networth.py`: Net worth related endpoints.
        -   `recurring.py`: Recurring items endpoints.
        -   `reports.py`: Report generation endpoints.
        -   `system.py`: System related endpoints.
        -   `transactions.py`: Transaction related endpoints.
        -   `users.py`: User management endpoints.
    -   `schemas/`: Pydantic schemas for data validation and serialization. They mirror the models.
    -   `services/`: Business logic for the application.
        -   `auth_service.py`: Handles authentication logic.
        -   `backup_service.py`: Handles backing up data.
        -   `mortgage_service.py`: Handles mortgage calculations.
        -   `networth_service.py`: Handles net worth calculations.
        -   `recurring_service.py`: Handles recurring item logic.
    -   `scheduler/`: APScheduler jobs.
        -   `setup.py`: Initializes and starts the scheduler.
        -   `jobs/`: Contains the actual cron jobs.
            -   `auto_post_recurring.py`: Automatically posts recurring transactions.
            -   `backup.py`: Regularly backs up the database.
            -   `net_worth_snapshot.py`: Takes a daily snapshot of the net worth.
    -   `utils/`: Utility functions.
        -   `date_utils.py`: Date utility functions.
        -   `pagination.py`: Pagination utility.
        -   `security.py`: Security related functions (e.g., password hashing).
-   `requirements.txt`: Python dependencies.
-   `Dockerfile`: Dockerfile for building the backend image.
-   `alembic.ini`: Alembic configuration file.
-   `backups/`: Directory for database backups.

### Features

The backend provides the following features:

-   User authentication (JWT based).
-   Account management.
-   Budgeting.
-   Transaction tracking.
-   Category management (includes `once_per_month` flag: categories marked this way can only be attached to one active recurring bill).
-   Mortgage calculator.
-   Net worth tracking.
-   Recurring transactions (validates that `once_per_month` categories are not reused across multiple active items).
-   Reporting.
-   Dashboard data aggregation.
-   Regular database backups.

The API is structured with versioning (`/api/v1`).

## Frontend

The frontend is a React application built with Vite and written in TypeScript.

### Project Structure

-   `src/`: The main source code directory.
    -   `main.tsx`: The entry point of the application. It sets up the React Query client and renders the `App` component.
    -   `App.tsx`: The root component that sets up the routing.
    -   `api/`: Contains functions for making API calls to the backend. Each file corresponds to a backend feature.
        -   `client.ts`: The configured Axios instance for making API requests.
    -   `components/`: Reusable React components.
        -   `common/`: Common components used across the application.
        -   `layout/`: Components related to the application layout (e.g., `AppShell`, `Sidebar`, `Header`).
        -   `ui/`: Generic UI components (e.g., `Button`, `Input`, `Card`).
        -   Other directories correspond to specific features.
    -   `hooks/`: Custom React hooks.
    -   `lib/`: Utility functions.
    -   `pages/`: The main pages of the application.
        -   `LoginPage.tsx`: The login page.
        -   `DashboardPage.tsx`: The main dashboard page.
        -   `TransactionsPage.tsx`: Page for managing transactions.
        -   `BudgetsPage.tsx`: Page for managing budgets.
        -   `RecurringPage.tsx`: Page for managing recurring transactions.
        -   `MortgagePage.tsx`: Page for the mortgage calculator.
        -   `LoanPage.tsx`: Page for managing loans.
        -   `NetWorthPage.tsx`: Page for tracking net worth.
        -   `ReportsPage.tsx`: Page for viewing reports.
        -   `SettingsPage.tsx`: Page for user settings.
    -   `store/`: State management stores (Zustand).
        -   `authStore.ts`: Manages authentication state.
        -   `dashboardStore.ts`: Manages dashboard state.
        -   `themeStore.ts`: Manages theme state (dark/light mode).
    -   `types/`: TypeScript type definitions.
-   `package.json`: Project metadata and dependencies.
-   `vite.config.ts`: Vite configuration file.
-   `tailwind.config.ts`: Tailwind CSS configuration file.
-   `Dockerfile`: Dockerfile for building the frontend image.

### Tech Stack

-   **Framework**: React
-   **Build Tool**: Vite
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS
-   **UI Components**: Radix UI, Lucide React
-   **Routing**: React Router
-   **State Management**: Zustand, TanStack Query
-   **API Client**: Axios

## Docker & Nginx

The application is fully containerized using Docker.

-   `docker-compose.yml`: Defines the services for the application.
    -   `postgres`: The PostgreSQL database.
    -   `backend`: The FastAPI backend application.
    -   `frontend`: An Nginx server that serves the frontend and proxies to the backend.
    -   `backup-cron`: A cron job to backup the database.
-   `docker-compose.override.yml`: Development specific overrides. It enables hot-reloading for the backend and exposes the database port.
-   `nginx/nginx.conf`: Nginx configuration file. It's responsible for serving the frontend static files and proxying API requests to the backend.
-   `backup/`: Contains the script and Dockerfile for the database backup cron job.
