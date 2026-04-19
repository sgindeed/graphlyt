FROM apache/age:latest

USER root

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

COPY . .
RUN chmod +x start.sh

# --- THE FIX IS HERE ---
ENV POSTGRES_DB=knowledge_graph_db
ENV POSTGRES_PASSWORD=neural_secret_password
# -----------------------

ENV PGDATA=/var/lib/postgresql/data/pgdata
ENV DATABASE_URL=postgresql://postgres:neural_secret_password@localhost:5432/knowledge_graph_db

EXPOSE 8000

CMD ["./start.sh"]
