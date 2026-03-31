import logging
import os
from datetime import datetime, timezone

from fastapi import FastAPI

logger = logging.getLogger(__name__)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.auth.endpoint import router as auth_router
from app.api.user.endpoint import router as user_router
from app.api.service.endpoint import router as service_router
from app.api.task.endpoint import router as task_router
from app.api.admin.endpoint import router as admin_router
from app.api.booking.endpoint import router as booking_router
from app.api.ai.endpoint import router as ai_router
from app.api.notification.endpoint import router as notification_router
from app.api.secretary.endpoint import router as secretary_router
from app.api.request.endpoint import router as request_router
from app.core.database import Base, engine, SessionLocal
from app.core.config import settings       # ← reads from .env
from app.internal import models            # Load models so SQLAlchemy creates tables
from app.core import security

try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    logger.warning("Database connection failed on startup: %s", e)
    logger.warning("App will start but DB-dependent endpoints may fail until DB is available.")


def seed_superadmin():
    """Create the superadmin user on startup if they don't exist yet."""
    try:
        db = SessionLocal()
        existing = db.query(models.User).filter(
            models.User.email == settings.SUPERADMIN_EMAIL
        ).first()
        if not existing:
            admin = models.User(
                username=settings.SUPERADMIN_USERNAME,
                email=settings.SUPERADMIN_EMAIL,
                hashed_password=security.get_password_hash(settings.SUPERADMIN_PASSWORD),
                role="ADMIN",
                is_active=True,
            )
            db.add(admin)
            db.commit()
            logger.info("Superadmin seeded: %s", settings.SUPERADMIN_EMAIL)
        else:
            logger.info("Superadmin already exists: %s", settings.SUPERADMIN_EMAIL)
        db.close()
    except Exception as e:
        logger.warning("Could not seed superadmin: %s", e)


seed_superadmin()

app = FastAPI(
    title="HomeCare Hub API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json"
)

# CORS — allow local development origins + dynamic frontend URL
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in cors_origins:
    cors_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)



# Serve uploaded files (profile photos, etc.)
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Versioned API Routes
app.include_router(auth_router,    prefix="/api/v1/auth")
app.include_router(user_router,    prefix="/api/v1/user")
app.include_router(service_router, prefix="/api/v1/services")
app.include_router(task_router,    prefix="/api/v1/maintenance")
app.include_router(admin_router,   prefix="/api/v1/admin")
app.include_router(ai_router,      prefix="/api/v1/ai")
app.include_router(booking_router, prefix="/api/v1/bookings")
app.include_router(notification_router, prefix="/api/v1/notifications")
app.include_router(secretary_router, prefix="/api/v1/secretary")
app.include_router(request_router, prefix="/api/v1/requests")

@app.get("/")
def root():
    return {"message": "HomeCare Hub API Operational"}

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "timestamp": str(datetime.now(timezone.utc))}
