#!/bin/sh
set -e

# Source auto-generated secrets from the shared volume, but only for vars
# that are not already set (explicit .env / docker-compose values take priority).
if [ -f /run/secrets/secrets.env ]; then
  while IFS= read -r line; do
    case "$line" in
      '#'*|'') continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    # eval-safe: only export if the variable is currently empty
    eval "existing=\${${key}:-}"
    if [ -z "$existing" ]; then
      export "${key}=${value}"
    fi
  done < /run/secrets/secrets.env
fi

# If POSTGRES_PASSWORD came from the secrets volume, also read it for DATABASE_URL.
# Build DATABASE_URL from components when it hasn't been set explicitly.
if [ -z "$DATABASE_URL" ]; then
  # Read pg_password file if POSTGRES_PASSWORD is still empty
  if [ -z "$POSTGRES_PASSWORD" ] && [ -f /run/secrets/pg_password ]; then
    POSTGRES_PASSWORD="$(cat /run/secrets/pg_password)"
    export POSTGRES_PASSWORD
  fi
  export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER:-denarius}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-postgres}:5432/${POSTGRES_DB:-denarius}"
fi

exec "$@"
