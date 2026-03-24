import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, Base, engine
from app.internal.models import User, MaintenanceTask, Society, ServiceProvider
from app.core.security import get_password_hash
from datetime import date, timedelta

def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # 1. Create Societies
    societies = [
        Society(name="Green Valley Residents", address="123 Park Ave, New York"),
        Society(name="Skyline Heights Hub", address="456 Tech Blvd, San Francisco"),
    ]
    db.add_all(societies)
    db.commit()
    for s in societies: db.refresh(s)
    
    # 2. Create Users
    user_harshil = User(
        email="harshil123@gmail.com",
        username="harshil",
        hashed_password=get_password_hash("Hp@1234"),
        role="SERVICER",
        is_active=True
    )
    db.add(user_harshil)
    
    user_demo = User(
        email="demo@homecare.com",
        username="Demo User",
        hashed_password=get_password_hash("password123"),
        role="USER",
        society_id=societies[0].id
    )
    db.add(user_demo)

    db.commit()
    db.refresh(user_harshil)
    db.refresh(user_demo)
    
    # 3. Create Service Providers
    providers = [
        ServiceProvider(
            user_id=user_harshil.id, 
            company_name="Harshil Tech Services",
            owner_name="Harshil",
            category="Electrical",
            phone="+91-9876543210",
            email="harshil123@gmail.com",
            is_verified=True,
            qualification="B.Tech Electrical",
            government_id="GOV-IND-001",
            rating=5.0
        ),
        ServiceProvider(
            company_name="Alpha Plumbing Co.",
            owner_name="Robert Alpha",
            category="Plumbing",
            phone="+1-555-0101",
            email="contact@alphaplumbing.com",
            is_verified=True,
            qualification="Certified Master Plumber",
            government_id="CERT-PL-992",
            society_id=societies[0].id
        ),
    ]
    db.add_all(providers)
    
    # 4. Create Demo Tasks
    tasks = [
        MaintenanceTask(
            title="AC Service",
            description="Bi-annual servicing of Living Room AC unit.",
            due_date=date.today() + timedelta(days=5),
            status="Pending",
            user_id=user_demo.id
        ),
        MaintenanceTask(
            title="Pest Control",
            description="Whole house treatment for insects.",
            due_date=date.today() + timedelta(days=2),
            status="Urgent",
            user_id=user_demo.id
        )
    ]
    db.add_all(tasks)
    
    db.commit()
    print("Database seeded with HomeCare Hub core data successfully!")
    db.close()

if __name__ == "__main__":
    seed()
