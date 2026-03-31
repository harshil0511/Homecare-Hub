"""
Database Cleanup Script
Deletes ALL row data from every table EXCEPT the superadmin user.
Tables and columns are NOT touched - only rows are removed.

Run from /backend:
    python clean_db.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.core.config import settings
from app.internal import models
from sqlalchemy import text

def clean():
    db = SessionLocal()
    try:
        superadmin = db.query(models.User).filter(
            models.User.email == settings.SUPERADMIN_EMAIL
        ).first()

        if not superadmin:
            print("ERROR: Superadmin not found. Aborting.")
            return

        print("Superadmin found: " + superadmin.username + " (" + superadmin.email + ")")
        print("Cleaning all records...\n")

        db.execute(text("DELETE FROM society_trusted_providers"))
        print("  cleared: society_trusted_providers")

        db.execute(text("DELETE FROM service_request_responses"))
        print("  cleared: service_request_responses")

        db.execute(text("DELETE FROM service_request_recipients"))
        print("  cleared: service_request_recipients")

        db.execute(text("DELETE FROM service_requests"))
        print("  cleared: service_requests")

        db.execute(text("DELETE FROM booking_reviews"))
        print("  cleared: booking_reviews")

        db.execute(text("DELETE FROM booking_chats"))
        print("  cleared: booking_chats")

        db.execute(text("DELETE FROM booking_status_history"))
        print("  cleared: booking_status_history")

        db.execute(text("DELETE FROM maintenance_tasks"))
        print("  cleared: maintenance_tasks")

        db.execute(text("DELETE FROM notifications"))
        print("  cleared: notifications")

        db.execute(text("DELETE FROM service_certificates"))
        print("  cleared: service_certificates")

        db.execute(text("DELETE FROM society_requests"))
        print("  cleared: society_requests")

        db.execute(text("DELETE FROM service_bookings"))
        print("  cleared: service_bookings")

        db.execute(text("DELETE FROM service_providers"))
        print("  cleared: service_providers")

        db.execute(text("UPDATE users SET society_id = NULL"))
        print("  cleared: users.society_id (nulled)")

        db.execute(text("UPDATE societies SET owner_id = NULL, secretary_id = NULL, manager_id = NULL"))
        db.execute(text("DELETE FROM societies"))
        print("  cleared: societies")

        db.execute(
            text("DELETE FROM users WHERE email != :email"),
            {"email": settings.SUPERADMIN_EMAIL}
        )
        print("  cleared: all users except superadmin")

        db.commit()
        print("\nDone. Database cleaned. Superadmin login preserved: " + settings.SUPERADMIN_EMAIL)

    except Exception as e:
        db.rollback()
        print("ERROR: " + str(e))
        raise
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input(
        "\nWARNING: This will DELETE ALL data except the superadmin.\n"
        "Type 'yes' to confirm: "
    ).strip().lower()

    if confirm == "yes":
        clean()
    else:
        print("Aborted.")
