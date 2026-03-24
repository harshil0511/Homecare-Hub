"""
SuperAdmin Seeder Script
========================
Run this ONCE to create or update the designated SuperAdmin account.
Usage:
    cd homecare-hub/backend
    python scripts/seed_superadmin.py
"""
import sys
import os

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.security import get_password_hash
from app.internal.models import User


def seed_superadmin():
    db = SessionLocal()
    try:
        email = settings.SUPERADMIN_EMAIL
        password = settings.SUPERADMIN_PASSWORD

        existing = db.query(User).filter(User.email == email).first()

        if existing:
            # Update existing user to ensure ADMIN role and active status
            existing.role = "ADMIN"
            existing.is_active = True
            existing.hashed_password = get_password_hash(password)
            db.commit()
            print(f"✅ SuperAdmin account updated: {email} (role forced to ADMIN)")
        else:
            # Create new SuperAdmin user
            superadmin = User(
                email=email,
                username="SuperAdmin",
                hashed_password=get_password_hash(password),
                role="ADMIN",
                is_active=True,
            )
            db.add(superadmin)
            db.commit()
            db.refresh(superadmin)
            print(f"✅ SuperAdmin account created: {email}")

        print(f"   Login with: {email} / {password}")
        print(f"   Role: ADMIN — Full system access granted.")

    except Exception as e:
        print(f"❌ Error seeding SuperAdmin: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_superadmin()
