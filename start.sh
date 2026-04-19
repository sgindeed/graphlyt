#!/bin/bash
# 1. Start Postgres in the background
docker-entrypoint.sh postgres &

# 2. Wait for Postgres to be ready
until pg_isready -h localhost -p 5432; do
  echo "Waiting for database..."
  sleep 2
done

# 3. Start the FastAPI App
uvicorn main:app --host 0.0.0.0 --port 8000
