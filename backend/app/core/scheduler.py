import logging
from datetime import datetime, timedelta, date, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.database import SessionLocal
from app.internal.models import MaintenanceTask, Notification

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
                MaintenanceTask.status.notin_(["Completed", "Cancelled", "Expired"])
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
                    link=f"/user/routine?taskId={task.id}",
                ))
                task.warning_sent = True

            # Stage 2 — due today notification
            elif due == today and not task.final_sent:
                db.add(Notification(
                    user_id=task.user_id,
                    title="MAINTENANCE DUE TODAY",
                    message=f"Your '{task.title}' maintenance is scheduled for today. Take action now.",
                    notification_type="URGENT",
                    link=f"/user/routine?taskId={task.id}",
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
                    link=f"/user/routine?taskId={task.id}",
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


def start_scheduler() -> None:
    scheduler.add_job(
        _check_alert_notifications,
        trigger="interval",
        hours=1,
        id="alert_notifications",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.start()
    logger.info("Alert notification scheduler started.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Alert notification scheduler stopped.")
