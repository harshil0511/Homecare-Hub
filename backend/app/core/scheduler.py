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
            is_alert = task.task_type == "user_alert"

            # Stage 1 — warning notification (2 days before)
            if due == two_days_later and not task.warning_sent:
                if is_alert:
                    title = f"Service Reminder — {task.title} in 2 Days"
                    message = (
                        f"Your '{task.title}' service is coming up on {due.strftime('%d %b %Y')}. "
                        "Find an expert on this platform before it's too late."
                    )
                    link = "/user/providers"
                else:
                    title = "Maintenance Reminder — 2 Days Left"
                    message = f"Your '{task.title}' maintenance is due in 2 days on {due.strftime('%d %b %Y')}. Don't forget!"
                    link = "/user/alerts"
                db.add(Notification(
                    user_id=task.user_id,
                    title=title,
                    message=message,
                    notification_type="WARNING",
                    link=link,
                ))
                task.warning_sent = True

            # Stage 2 — due today notification
            elif due == today and not task.final_sent:
                if is_alert:
                    title = f"Today: {task.title} Scheduled"
                    message = (
                        f"Today is your scheduled '{task.title}' service day. "
                        "Head to Find Experts to book a provider now."
                    )
                    link = "/user/providers"
                else:
                    title = "MAINTENANCE DUE TODAY"
                    message = f"Your '{task.title}' maintenance is scheduled for today. Take action now."
                    link = "/user/alerts"
                db.add(Notification(
                    user_id=task.user_id,
                    title=title,
                    message=message,
                    notification_type="URGENT",
                    link=link,
                ))
                task.final_sent = True
                if not is_alert:
                    task.status = "Triggered"

            # Stage 3 — overdue notification (1+ days past due)
            elif due < today and not task.overdue_sent:
                if is_alert:
                    title = f"Overdue: {task.title} Service Not Done"
                    message = (
                        f"Your '{task.title}' service was scheduled for {due.strftime('%d %b %Y')}. "
                        "Please mark it done or cancel the reminder."
                    )
                    link = "/user/alerts"
                else:
                    title = "OVERDUE: Maintenance Missed"
                    message = f"Your '{task.title}' maintenance was due on {due.strftime('%d %b %Y')}. Please take action."
                    link = "/user/alerts"
                db.add(Notification(
                    user_id=task.user_id,
                    title=title,
                    message=message,
                    notification_type="URGENT",
                    link=link,
                ))
                task.overdue_sent = True
                if not is_alert:
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


def _send_booking_reminders() -> None:
    """Run every hour. Send a reminder notification ~24 h before each scheduled booking."""
    from app.booking.domain.model import ServiceBooking
    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        # 1-hour window centred on 24 h from now — each booking hits this window only once
        window_start = now + timedelta(hours=23, minutes=30)
        window_end   = now + timedelta(hours=24, minutes=30)

        upcoming = (
            db.query(ServiceBooking)
            .filter(
                ServiceBooking.status.in_(["Accepted", "Pending"]),
                ServiceBooking.scheduled_at >= window_start,
                ServiceBooking.scheduled_at <= window_end,
            )
            .all()
        )

        for booking in upcoming:
            db.add(Notification(
                user_id=booking.user_id,
                title=f"Reminder — {booking.service_type} Tomorrow",
                message=(
                    f"Your {booking.service_type} booking is scheduled for "
                    f"{booking.scheduled_at.strftime('%b %d at %H:%M')}. "
                    "Make sure someone is available."
                ),
                notification_type="INFO",
                link=f"/user/bookings/{booking.id}",
            ))

        if upcoming:
            db.commit()
            logger.info("Booking reminders sent for %d upcoming bookings.", len(upcoming))
    except Exception:
        logger.exception("Booking reminder scheduler failed.")
        db.rollback()
    finally:
        db.close()


def _cleanup_old_notifications() -> None:
    """Run daily. Delete read notifications older than 90 days."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=90)
        deleted = (
            db.query(Notification)
            .filter(Notification.is_read == True, Notification.created_at < cutoff)
            .delete(synchronize_session=False)
        )
        if deleted:
            db.commit()
            logger.info("Notification cleanup: deleted %d old read notifications.", deleted)
    except Exception:
        logger.exception("Notification cleanup scheduler failed.")
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
    scheduler.add_job(
        _send_booking_reminders,
        trigger="interval",
        hours=1,
        id="booking_reminders",
        replace_existing=True,
        misfire_grace_time=300,
    )
    scheduler.add_job(
        _cleanup_old_notifications,
        trigger="interval",
        hours=24,
        id="notification_cleanup",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    logger.info("Alert notification scheduler started.")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Alert notification scheduler stopped.")
