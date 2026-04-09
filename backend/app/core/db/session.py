import logging
import threading
import time
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.db.base import Base

logger = logging.getLogger(__name__)

engine = None
SessionLocal = None

_retry_thread: threading.Thread | None = None


def _build_engine():
    urls_to_try = [
        settings.DATABASE_URL,
        settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql+psycopg2://"),
        settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://"),
    ]
    seen = set()
    unique_urls = []
    for u in urls_to_try:
        if u not in seen:
            seen.add(u)
            unique_urls.append(u)

    for url in unique_urls:
        try:
            eng = create_engine(
                url,
                echo=False,
                pool_pre_ping=True,
                pool_recycle=1800,
                connect_args={"connect_timeout": 10},
            )
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("✅ Database connected via: %s", url.split("@")[-1])
            return eng
        except Exception as e:
            logger.warning("⚠️  Could not connect with URL (%s): %s", url.split("@")[-1], e)

    return None


def _apply_engine(eng):
    global engine, SessionLocal
    engine = eng
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    try:
        # Import all domain models to register them with Base.metadata
        from app.auth.domain import model as _auth  # noqa
        from app.service.domain import model as _service  # noqa
        from app.booking.domain import model as _booking  # noqa
        from app.maintenance.domain import model as _maintenance  # noqa
        from app.notification.domain import model as _notification  # noqa
        from app.request.domain import model as _request  # noqa
        from app.emergency.domain import model as _emergency  # noqa

        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created/verified.")
    except Exception as e:
        logger.warning("⚠️  create_all failed: %s", e)

    try:
        from app.core import security
        from app.core.config import settings as cfg
        from app.auth.domain.model import User
        db = SessionLocal()
        try:
            existing = db.query(User).filter(User.email == cfg.SUPERADMIN_EMAIL).first()
            if not existing:
                admin = User(
                    username=cfg.SUPERADMIN_USERNAME,
                    email=cfg.SUPERADMIN_EMAIL,
                    hashed_password=security.get_password_hash(cfg.SUPERADMIN_PASSWORD),
                    role="ADMIN",
                    is_active=True,
                )
                db.add(admin)
                db.commit()
                logger.info("✅ Superadmin seeded: %s", cfg.SUPERADMIN_EMAIL)
        finally:
            db.close()
    except Exception as e:
        logger.warning("⚠️  Could not seed superadmin: %s", e)


def _retry_loop():
    global engine
    attempt = 0
    while True:
        time.sleep(5)
        if engine is not None:
            break
        attempt += 1
        logger.info("🔄 DB retry attempt #%d ...", attempt)
        eng = _build_engine()
        if eng is not None:
            _apply_engine(eng)
            logger.info("✅ Database auto-reconnected after %d attempt(s).", attempt)
            break
        else:
            logger.warning("⏳ DB still unavailable, retrying in 5s ...")


def init_db() -> bool:
    global _retry_thread
    eng = _build_engine()
    if eng is not None:
        _apply_engine(eng)
        return True

    logger.warning(
        "⚠️  DB unavailable at startup — background retry started. "
        "API will return 503 until the database is reachable."
    )
    _retry_thread = threading.Thread(target=_retry_loop, daemon=True, name="db-retry")
    _retry_thread.start()
    return False
