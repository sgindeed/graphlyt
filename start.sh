#!/bin/bash
# Start Postgres in the background
docker-entrypoint.sh postgres &

# Wait for Postgres to be ready
echo "Waiting for Postgres to start..."
until pg_isready -h localhost -p 5432; do
  sleep 2
done

# Start the FastAPI App
echo "Starting FastAPI..."
uvicorn main:app --host 0.0.0.0 --port 8000
