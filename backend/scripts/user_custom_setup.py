import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.internal.models import User
from app.core import security

def create_requested_user():
    db = SessionLocal()
    email = "chaudharyhp628@gmail.com"
    username = "harshi chaudhari"
    password = "Hp@123"
    
    # Check if exists
    user = db.query(User).filter(User.email == email).first()
    if user:
        print("User already exists. Updating password.")
        user.hashed_password = security.get_password_hash(password)
        db.commit()
    else:
        print("Creating new user...")
        new_user = User(
            email=email,
            username=username,
            hashed_password=security.get_password_hash(password)
        )
        db.add(new_user)
        db.commit()
        print("User created successfully!")
    db.close()

if __name__ == "__main__":
    create_requested_user()
