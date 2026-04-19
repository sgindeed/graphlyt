#!/bin/bash
# 1. Start Postgres in the background
docker-entrypoint.sh postgres &

# 2. Wait for Postgres to be ready
echo "Waiting for Postgres to start..."
until pg_isready -h localhost -p 5432 -U postgres; do
  sleep 2
done

# 3. Enter the backend folder and start the app
echo "Moving to backend folder and starting FastAPI..."
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
