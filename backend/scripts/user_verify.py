import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.internal.models import User

def check_user():
    db = SessionLocal()
    email = "chaudharyhp628@gmail.com"
    user = db.query(User).filter(User.email == email).first()
    if user:
        print(f"User FOUND: {user.username} ({user.email})")
    else:
        print("User NOT found in database.")
    db.close()

if __name__ == "__main__":
    check_user()
