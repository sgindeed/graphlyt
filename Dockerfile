# Use Apache AGE (which is Postgres + AGE extension)
FROM apache/age:latest

# Install Python and Pip
USER root
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv libpq-dev gcc

# Set up Python environment
WORKDIR /app
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy your code and the start script
COPY . .
RUN chmod +x start.sh

# Tell Postgres where to store data (Inside the container)
ENV PGDATA=/var/lib/postgresql/data/pgdata
ENV POSTGRES_PASSWORD=neural_secret_password
ENV DATABASE_URL=postgresql://postgres:neural_secret_password@localhost:5432/postgres

EXPOSE 8000

# Run the startup script
CMD ["./start.sh"]
