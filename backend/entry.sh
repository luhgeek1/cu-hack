#!/usr/bin/env bash
set -e

echo "Running Alembic migrations..."
cd src
alembic upgrade head

echo "Starting the application..."
# One worker means one slow request stalls every other client. Keep this at 1 if the
# scheduler ever registers jobs, otherwise each worker would fire them separately.
exec uvicorn main:app \
  --host "${API_HOST:-0.0.0.0}" \
  --port "${API_PORT:-8080}" \
  --workers "${API_WORKERS:-2}" \
  --proxy-headers \
  --forwarded-allow-ips "${FORWARDED_ALLOW_IPS:-*}"
