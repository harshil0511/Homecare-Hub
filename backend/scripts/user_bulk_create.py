import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, engine, Base
from app.internal.models import User
from app.core import security

def create_test_users():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        users_to_create = [
            {
                "email": "nidhi123@gmail.com",
                "username": "nidhi12",
                "password": "Hp@12345",
                "role": "USER"
            },
            {
                "email": "sneh12@gmail.com",
                "username": "sneh",
                "password": "Sneh@12",
                "role": "SERVICER"
            }
        ]
        
        for u_data in users_to_create:
            # Check if user already exists
            user = db.query(User).filter(User.email == u_data["email"]).first()
            if user:
                print(f"User {u_data['email']} already exists. Updating password for test.")
                user.hashed_password = security.get_password_hash(u_data["password"])
                db.add(user)
            else:
                hashed_password = security.get_password_hash(u_data["password"])
                new_user = User(
                    email=u_data["email"],
                    username=u_data["username"],
                    hashed_password=hashed_password,
                    role=u_data["role"],
                    is_active=True
                )
                db.add(new_user)
                print(f"Created user: {u_data['email']} with role '{u_data['role']}'")
        
        db.commit()
    except Exception as e:
        print(f"Error creating users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_test_users()
