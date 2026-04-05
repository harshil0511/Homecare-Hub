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

# Copy pyproject.toml first (layer cache — only re-runs pip install if deps change)
COPY pyproject.toml .

# Install Python dependencies
RUN pip install --upgrade pip && \
    pip install setuptools wheel && \
    pip install -e .

# Copy entire backend code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8002

# Run Uvicorn (production — no --reload)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]