from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Checking for missing columns in 'societies' table...")
        
        # Add creator_role if missing
        try:
            conn.execute(text("ALTER TABLE societies ADD COLUMN creator_role VARCHAR DEFAULT 'OWNER'"))
            conn.commit()
            print("Successfully added 'creator_role' column.")
        except Exception as e:
            print(f"Column 'creator_role' might already exist or error: {e}")

        # Add registration_number if missing (just in case)
        try:
            conn.execute(text("ALTER TABLE societies ADD COLUMN registration_number VARCHAR UNIQUE"))
            conn.commit()
            print("Successfully added 'registration_number' column.")
        except Exception as e:
            print(f"Column 'registration_number' might already exist or error: {e}")

if __name__ == "__main__":
    migrate()
