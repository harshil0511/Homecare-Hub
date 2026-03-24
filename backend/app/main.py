import os 
from datetime import datetime
from fastapi import FastAPI
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
from app.core.database import Base, engine
from app.core.config import settings       # ← reads from .env
from app.internal import models            # Load models so SQLAlchemy creates tables

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HomeCare Hub API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json"
)

# CORS — allow local development origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/")
def root():
    return {"message": "HomeCare Hub API Operational"}

@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "timestamp": str(datetime.utcnow())}
