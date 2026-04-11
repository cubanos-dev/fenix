#!/usr/bin/env bash
set -euo pipefail

# test-db-setup.sh — start a local Postgres for integration tests and run migrations.
#
# Usage:
#   scripts/test-db-setup.sh              # start docker, run migrations
#   scripts/test-db-setup.sh --check      # print plan, do not touch docker or the db
#
# The --check flag is useful for CI lint or for validating that docker is not
# required just to see what the script would do.

DRY_RUN=0
if [[ "${1:-}" == "--check" ]]; then
  DRY_RUN=1
fi

DB_URL="postgresql://fenix_test:fenix_test@localhost:5433/fenix_test"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[test-db-setup] dry run — would:"
  echo "  1. docker compose -f docker-compose.test.yml up -d --wait"
  echo "  2. export DATABASE_URL=$DB_URL"
  echo "  3. export DATABASE_URL_UNPOOLED=$DB_URL"
  echo "  4. export USE_PG_DRIVER=true"
  echo "  5. (cd apps/app && bun run lib/migrator.ts)"
  echo "[test-db-setup] ok"
  exit 0
fi

echo "Starting test database..."
docker compose -f docker-compose.test.yml up -d --wait

# Export env vars for migrations
export DATABASE_URL="$DB_URL"
export DATABASE_URL_UNPOOLED="$DB_URL"
export USE_PG_DRIVER="true"

# Run migrations
echo "Running migrations..."
cd apps/app
bun run lib/migrator.ts
cd ../..

echo "Test database ready on port 5433."
