import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.auth.endpoints import router as auth_router
from app.api.user.endpoints import router as user_router
from app.api.service.endpoints import router as service_router
from app.api.service.analytics_endpoints import router as analytics_router
from app.api.maintenance.endpoints import router as task_router
from app.api.admin.endpoints import router as admin_router
from app.api.admin.emergency_endpoints import router as admin_emergency_router
from app.api.booking.endpoints import router as booking_router
from app.api.ai.endpoints import router as ai_router
from app.api.notification.endpoints import router as notification_router
from app.api.secretary.endpoints import router as secretary_router
from app.api.request.endpoints import router as request_router
from app.api.emergency.endpoints import router as emergency_router, servicer_router as emergency_servicer_router
from app.core.db.session import init_db, SessionLocal
from app.core.config import settings
from app.core.scheduler import start_scheduler, stop_scheduler
from app.websockets.emergency import emergency_manager

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


DEFAULT_PENALTY_CONFIGS = [
    {"event_type": "LATE_ARRIVAL",  "star_deduction": 0.5},
    {"event_type": "CANCELLATION",  "star_deduction": 1.0},
    {"event_type": "NO_SHOW",       "star_deduction": 1.5},
]


def _seed_penalty_configs() -> None:
    """Insert default EmergencyPenaltyConfig rows if they don't already exist."""
    if SessionLocal is None:
        logger.warning("SessionLocal not ready — skipping penalty config seed.")
        return
    from app.emergency.domain.model import EmergencyPenaltyConfig
    db = SessionLocal()
    try:
        for cfg in DEFAULT_PENALTY_CONFIGS:
            exists = db.query(EmergencyPenaltyConfig).filter(
                EmergencyPenaltyConfig.event_type == cfg["event_type"]
            ).first()
            if not exists:
                db.add(EmergencyPenaltyConfig(
                    event_type=cfg["event_type"],
                    star_deduction=cfg["star_deduction"],
                    created_at=datetime.now(timezone.utc).replace(tzinfo=None),
                    updated_at=datetime.now(timezone.utc).replace(tzinfo=None),
                ))
        db.commit()
        logger.info("Emergency penalty configs seeded.")
    except Exception:
        logger.exception("Failed to seed penalty configs.")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, seed configs, start alert scheduler. Shutdown: stop scheduler."""
    logger.info("Starting HomeCare Hub API ...")
    init_db()
    _seed_penalty_configs()
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Shutting down HomeCare Hub API.")


app = FastAPI(
    title="HomeCare Hub API",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all for unhandled exceptions.
    Without this, Starlette's ServerErrorMiddleware returns the 500 response
    *before* CORSMiddleware can attach 'Access-Control-Allow-Origin', causing
    the browser to report a CORS error instead of the real server error.
    """
    logger.exception("Unhandled server error: %s %s → %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
    )


# ── CORS ──────────────────────────────────────────────────────────────────────
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
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

# ── Static uploads ─────────────────────────────────────────────────────────────
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth_router,         prefix="/api/v1/auth")
app.include_router(user_router,         prefix="/api/v1/user")
app.include_router(service_router,      prefix="/api/v1/services")
app.include_router(analytics_router,    prefix="/api/v1/services")
app.include_router(task_router,         prefix="/api/v1/maintenance")
app.include_router(admin_router,        prefix="/api/v1/admin")
app.include_router(ai_router,           prefix="/api/v1/ai")
app.include_router(booking_router,      prefix="/api/v1/bookings")
app.include_router(notification_router, prefix="/api/v1/notifications")
app.include_router(secretary_router,    prefix="/api/v1/secretary")
app.include_router(request_router,          prefix="/api/v1/requests")
app.include_router(emergency_router,        prefix="/api/v1/emergency")
app.include_router(emergency_servicer_router, prefix="/api/v1/emergency")
app.include_router(admin_emergency_router,  prefix="/api/v1/admin/emergency")


# ── WebSocket endpoints ────────────────────────────────────────────────────────

@app.websocket("/ws/emergency/{request_id}")
async def ws_user_emergency(websocket: WebSocket, request_id: str):
    """User watches their SOS request for real-time servicer responses."""
    await emergency_manager.connect_user(request_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep connection alive; server pushes
    except WebSocketDisconnect:
        emergency_manager.disconnect_user(request_id)


@app.websocket("/ws/servicer/alerts")
async def ws_servicer_alerts(websocket: WebSocket, provider_id: str):
    """Servicer listens for incoming emergency alert broadcasts."""
    await emergency_manager.connect_servicer(provider_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep connection alive; server pushes
    except WebSocketDisconnect:
        emergency_manager.disconnect_servicer(provider_id)


# ── Basic routes ───────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "HomeCare Hub API Operational"}


@app.get("/api/v1/health")
def health_check():
    from app.core.db.session import engine
    db_status = "connected" if engine is not None else "unavailable"
    return {
        "status": "healthy",
        "database": db_status,
        "timestamp": str(datetime.now(timezone.utc)),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
