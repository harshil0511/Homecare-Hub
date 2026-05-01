FROM python:3.12-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/backend

# ✅ Fixed: psycopg[binary] bundles its own libpq — no need for gcc/libpq-dev
# Only keeping curl for optional health-check debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy pyproject.toml + app source so pip can find the package during install
COPY pyproject.toml .
COPY app/ app/

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install setuptools wheel && \
    pip install -e .

# Copy remaining files (alembic, scripts, etc.)
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port (Render overrides with $PORT at runtime)
EXPOSE 8002

# Run Uvicorn — uses $PORT from Render, falls back to 8002 locally
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8002}"]