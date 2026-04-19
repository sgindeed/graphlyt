FROM apache/age:latest

USER root

# Install Python and build tools for database drivers
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy the rest of your code
COPY . .
RUN chmod +x start.sh

# Environment Setup
ENV PGDATA=/var/lib/postgresql/data/pgdata
ENV POSTGRES_PASSWORD=neural_secret_password
ENV DATABASE_URL=postgresql://postgres:neural_secret_password@localhost:5432/postgres

EXPOSE 8000

CMD ["./start.sh"]
