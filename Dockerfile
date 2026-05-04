FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/ backend/
COPY asgi.py .

RUN mkdir -p backend/uploads

EXPOSE 8000

CMD ["sh", "-c", "uvicorn asgi:app --host 0.0.0.0 --port ${PORT:-8000}"]
