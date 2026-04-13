import logging
from datetime import datetime, timedelta, date, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.db.session import SessionLocal
from app.maintenance.domain.model import MaintenanceTask
from app.notification.domain.model import Notification
from app.contract.domain.model import SocietyContract

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC")


def _check_alert_notifications() -> None:
    """Run every hour. Fire WARNING / FINAL / OVERDUE notifications for due maintenance tasks."""
    db = SessionLocal()
    try:
        today = datetime.now(timezone.utc).date()
        two_days_later = today + timedelta(days=2)

        active_tasks = (
            db.query(MaintenanceTask)
            .filter(
                MaintenanceTask.due_date.isnot(None),
                MaintenanceTask.status.notin_(["Completed", "Cancelled", "Expired", "Assigned"])
            )
            .all()
        )

        for task in active_tasks:
            due: date = task.due_date

            # Stage 1 — warning notification (2 days before)
            if due == two_days_later and not task.warning_sent:
                db.add(Notification(
                    user_id=task.user_id,
                    title="Maintenance Reminder — 2 Days Left",
                    message=f"Your '{task.title}' maintenance is due in 2 days on {due.strftime('%d %b %Y')}. Don't forget!",
                    notification_type="WARNING",
                    link="/user/alerts",
                ))
                task.warning_sent = True

            # Stage 2 — due today notification
            elif due == today and not task.final_sent:
                db.add(Notification(
                    user_id=task.user_id,
                    title="MAINTENANCE DUE TODAY",
                    message=f"Your '{task.title}' maintenance is scheduled for today. Take action now.",
                    notification_type="URGENT",
                    link="/user/alerts",
                ))
                task.final_sent = True
                task.status = "Triggered"

            # Stage 3 — overdue notification (1+ days past due)
            elif due < today and not task.overdue_sent:
                db.add(Notification(
                    user_id=task.user_id,
                    title="OVERDUE: Maintenance Missed",
                    message=f"Your '{task.title}' maintenance was due on {due.strftime('%d %b %Y')}. Please take action.",
                    notification_type="URGENT",
                    link="/user/alerts",
                ))
                task.overdue_sent = True
                task.status = "Overdue"

            # Auto-expire after 7 days overdue (only if overdue was already set in a prior run)
            if task.overdue_sent and due < today - timedelta(days=7):
                task.status = "Expired"

        db.commit()
        logger.info("Alert notification check complete — processed %d tasks.", len(active_tasks))
    except Exception:
        logger.exception("Alert notification scheduler failed.")
        db.rollback()
    finally:
        db.close()


def _expire_contracts() -> None:
    """Run daily. Mark ACTIVE contracts whose end_date has passed as EXPIRED."""
    from app.auth.domain.model import User
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expired = (
            db.query(SocietyContract)
            .filter(
                SocietyContract.status == "ACTIVE",
                SocietyContract.end_date < now,
            )
            .all()
        )

        for contract in expired:
            contract.status = "EXPIRED"

            secretary_user = db.query(User).filter(User.id == contract.proposed_by).first()
            if secretary_user:
                db.add(Notification(
                    user_id=secretary_user.id,
                    title="Contract Expired",
                    message=(
                        f"The {contract.duration_months}-month contract has expired."
                    ),
                    notification_type="INFO",
                    link="/secretary/contracts",
                ))

            if contract.provider and contract.provider.user_id:
                db.add(Notification(
                    user_id=contract.provider.user_id,
                    title="Society Contract Expired",
                    message=f"Your contract with {contract.society.name} has expired.",
                    notification_type="INFO",
                    link="/service/jobs?tab=society",
                ))

        if expired:
            db.commit()
            logger.info("Contract expiry check complete — expired %d contracts.", len(expired))
    except Exception:
        logger.exception("Contract expiry scheduler failed.")
        db.rollback()
    finally:
        db.close()


def start_scheduler() -> None:
    scheduler.add_job(
        _check_alert_notifications,
        trigger="interval",
        hours=1,
        id="alert_notifications",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        _expire_contracts,
        trigger="interval",
        hours=24,
        id="contract_expiry",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("Alert notification scheduler started.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Alert notification scheduler stopped.")
