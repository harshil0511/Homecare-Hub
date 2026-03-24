from sqlalchemy.orm import Session
from app.api.auth.endpoint import signup
from app.internal.schemas import UserCreate
from app.internal.deps import get_db
from app.internal.models import User

# Mocking the dependencies
db = next(get_db())

try:
    # Check if user already exists
    existing = db.query(User).filter(User.email == "jems@gmail.com").first()
    if existing:
        print(f"User already exists: {existing.email}")
    else:
        user_in = UserCreate(
            email="jems@gmail.com",
            username="Jems",
            password="Jems@123",
            role="USER"
        )
        result = signup(user_in, db)
        print(f"Registration successful: {result.email}")
except Exception as e:
    print(f"Registration failed with error: {e}")
finally:
    db.close()
