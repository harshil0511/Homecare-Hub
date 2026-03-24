from sqlalchemy import create_all, text
from app.core.database import engine
import sys

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"DB Connection Successful: {result.fetchone()}")
except Exception as e:
    print(f"DB Connection Failed: {e}")
    sys.exit(1)
