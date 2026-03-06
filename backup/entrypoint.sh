#!/bin/sh
set -e

# Source auto-generated secrets from the shared volume.
# Only fills in variables that are not already set.
if [ -f /run/secrets/pg_password ] && [ -z "$PGPASSWORD" ]; then
  PGPASSWORD="$(cat /run/secrets/pg_password)"
  export PGPASSWORD
fi

exec "$@"
