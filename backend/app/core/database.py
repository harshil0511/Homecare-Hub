import logging
import threading
import time
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

Base = declarative_base()
engine = None
SessionLocal = None

_retry_thread: threading.Thread | None = None


def _build_engine():
    """Try to build the SQLAlchemy engine. Returns engine or None on failure."""
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
    """Set globals and run table creation + seed once a connection is established."""
    global engine, SessionLocal
    engine = eng
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    try:
        from app.internal import models  # noqa: ensure models registered

        Base.metadata.create_all(bind=engine)
        logger.info("✅ Database tables created/verified.")
    except Exception as e:
        logger.warning("⚠️  create_all failed: %s", e)

    # Seed superadmin
    try:
        from app.core import security
        from app.core.config import settings as cfg
        from app.internal import models as m
        db = SessionLocal()
        try:
            existing = db.query(m.User).filter(m.User.email == cfg.SUPERADMIN_EMAIL).first()
            if not existing:
                admin = m.User(
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
    """Background thread: keep retrying DB connection every 5 seconds until success."""
    global engine
    attempt = 0
    while True:
        time.sleep(5)
        if engine is not None:
            break  # already connected (e.g. another thread won the race)
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
    """
    Called on app startup.
    - If DB is ready: connects immediately, returns True.
    - If DB is not ready: starts a background retry thread and returns False.
      The app stays alive and auto-connects once postgres is up.
    """
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
