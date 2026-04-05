"""UUID primary keys — replace all Integer PKs and FKs with PostgreSQL UUID

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-04-06 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Drop everything in safe reverse-FK order ───────────────────────
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_star_adjustments CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_penalty_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_recipients CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS notifications CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS maintenance_tasks CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_reviews CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_chats CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_status_history CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_bookings CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_certificates CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_trusted_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS societies CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))

    # ── 2. Recreate with UUID PKs ──────────────────────────────────────────
    # users — create without society_id FK first (circular with societies)
    conn.execute(sa.text("""
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username VARCHAR,
            email VARCHAR UNIQUE NOT NULL,
            hashed_password VARCHAR NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            role VARCHAR DEFAULT 'USER',
            society_id UUID,
            home_number VARCHAR,
            resident_name VARCHAR
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_users_id ON users (id)"))
    conn.execute(sa.text("CREATE INDEX ix_users_username ON users (username)"))
    conn.execute(sa.text("CREATE UNIQUE INDEX ix_users_email ON users (email)"))

    # societies — references users (owner/secretary/manager)
    conn.execute(sa.text("""
        CREATE TABLE societies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR UNIQUE NOT NULL,
            address VARCHAR,
            secretary_name VARCHAR,
            is_legal BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW(),
            creator_role VARCHAR DEFAULT 'OWNER',
            registration_number VARCHAR UNIQUE,
            owner_id UUID REFERENCES users(id),
            secretary_id UUID REFERENCES users(id),
            manager_id UUID REFERENCES users(id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_societies_id ON societies (id)"))
    conn.execute(sa.text("CREATE UNIQUE INDEX ix_societies_name ON societies (name)"))

    # Now add the circular FK: users.society_id -> societies.id
    conn.execute(sa.text("""
        ALTER TABLE users ADD CONSTRAINT fk_users_society_id
        FOREIGN KEY (society_id) REFERENCES societies(id)
    """))

    # service_providers — references users, societies
    conn.execute(sa.text("""
        CREATE TABLE service_providers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            company_name VARCHAR,
            owner_name VARCHAR,
            first_name VARCHAR,
            last_name VARCHAR,
            age INTEGER,
            gender VARCHAR,
            category VARCHAR,
            categories TEXT,
            phone VARCHAR,
            email VARCHAR,
            hourly_rate FLOAT DEFAULT 0.0,
            availability TEXT,
            bio TEXT,
            education VARCHAR,
            experience_years INTEGER DEFAULT 0,
            availability_status VARCHAR DEFAULT 'AVAILABLE',
            is_verified BOOLEAN DEFAULT FALSE,
            certification_url VARCHAR,
            qualification VARCHAR,
            government_id VARCHAR,
            location VARCHAR,
            profile_photo_url VARCHAR,
            rating FLOAT DEFAULT 5.0,
            society_id UUID REFERENCES societies(id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_providers_id ON service_providers (id)"))
    conn.execute(sa.text("CREATE INDEX ix_service_providers_company_name ON service_providers (company_name)"))
    conn.execute(sa.text("CREATE INDEX ix_service_providers_category ON service_providers (category)"))

    # service_certificates — references service_providers
    conn.execute(sa.text("""
        CREATE TABLE service_certificates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID REFERENCES service_providers(id),
            category VARCHAR,
            title VARCHAR,
            certificate_url VARCHAR,
            is_verified BOOLEAN DEFAULT FALSE,
            uploaded_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_certificates_id ON service_certificates (id)"))

    # society_trusted_providers — association table
    conn.execute(sa.text("""
        CREATE TABLE society_trusted_providers (
            society_id UUID REFERENCES societies(id),
            provider_id UUID REFERENCES service_providers(id),
            created_at TIMESTAMP DEFAULT NOW(),
            PRIMARY KEY (society_id, provider_id)
        )
    """))

    # service_bookings — references users, service_providers
    conn.execute(sa.text("""
        CREATE TABLE service_bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            provider_id UUID REFERENCES service_providers(id),
            service_type VARCHAR,
            scheduled_at TIMESTAMP,
            status VARCHAR DEFAULT 'Pending',
            priority VARCHAR DEFAULT 'Normal',
            issue_description TEXT,
            photos TEXT,
            estimated_cost FLOAT DEFAULT 0.0,
            final_cost FLOAT DEFAULT 0.0,
            actual_hours FLOAT,
            completion_notes TEXT,
            completion_photos TEXT,
            property_details TEXT,
            source_type VARCHAR,
            source_id UUID,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_bookings_id ON service_bookings (id)"))

    # booking_status_history
    conn.execute(sa.text("""
        CREATE TABLE booking_status_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES service_bookings(id),
            status VARCHAR,
            notes TEXT,
            timestamp TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_booking_status_history_id ON booking_status_history (id)"))

    # booking_chats
    conn.execute(sa.text("""
        CREATE TABLE booking_chats (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES service_bookings(id),
            sender_id UUID REFERENCES users(id),
            message TEXT,
            timestamp TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_booking_chats_id ON booking_chats (id)"))

    # booking_reviews
    conn.execute(sa.text("""
        CREATE TABLE booking_reviews (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            booking_id UUID REFERENCES service_bookings(id),
            rating INTEGER,
            review_text TEXT,
            photos TEXT,
            quality_rating INTEGER DEFAULT 5,
            punctuality_rating INTEGER DEFAULT 5,
            professionalism_rating INTEGER DEFAULT 5,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_booking_reviews_id ON booking_reviews (id)"))

    # maintenance_tasks
    conn.execute(sa.text("""
        CREATE TABLE maintenance_tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR,
            description VARCHAR,
            due_date DATE,
            status VARCHAR DEFAULT 'Pending',
            priority VARCHAR DEFAULT 'Routine',
            category VARCHAR,
            location VARCHAR,
            task_type VARCHAR DEFAULT 'standard',
            booking_id UUID REFERENCES service_bookings(id),
            created_at TIMESTAMP DEFAULT NOW(),
            warning_sent BOOLEAN DEFAULT FALSE,
            final_sent BOOLEAN DEFAULT FALSE,
            overdue_sent BOOLEAN DEFAULT FALSE,
            completed_at TIMESTAMP,
            completion_method VARCHAR,
            user_id UUID REFERENCES users(id),
            service_provider_id UUID REFERENCES service_providers(id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_maintenance_tasks_id ON maintenance_tasks (id)"))
    conn.execute(sa.text("CREATE INDEX ix_maintenance_tasks_title ON maintenance_tasks (title)"))

    # notifications
    conn.execute(sa.text("""
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            title VARCHAR,
            message TEXT,
            notification_type VARCHAR DEFAULT 'INFO',
            is_read BOOLEAN DEFAULT FALSE,
            link VARCHAR,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_notifications_id ON notifications (id)"))

    # society_requests
    conn.execute(sa.text("""
        CREATE TABLE society_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            society_id UUID REFERENCES societies(id),
            provider_id UUID REFERENCES service_providers(id),
            sender_id UUID REFERENCES users(id),
            status VARCHAR DEFAULT 'PENDING',
            message TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_society_requests_id ON society_requests (id)"))

    # service_requests
    conn.execute(sa.text("""
        CREATE TABLE service_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            contact_name VARCHAR NOT NULL,
            contact_mobile VARCHAR NOT NULL,
            location VARCHAR NOT NULL,
            device_or_issue VARCHAR NOT NULL,
            description TEXT,
            photos TEXT,
            preferred_dates TEXT,
            urgency VARCHAR DEFAULT 'Normal',
            status VARCHAR DEFAULT 'OPEN',
            expires_at TIMESTAMP NOT NULL,
            resulting_booking_id UUID REFERENCES service_bookings(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_requests_id ON service_requests (id)"))

    # service_request_recipients
    conn.execute(sa.text("""
        CREATE TABLE service_request_recipients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES service_requests(id),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            is_read BOOLEAN DEFAULT FALSE,
            notified_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_request_recipients_id ON service_request_recipients (id)"))

    # service_request_responses
    conn.execute(sa.text("""
        CREATE TABLE service_request_responses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES service_requests(id),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            proposed_date TIMESTAMP NOT NULL,
            proposed_price FLOAT NOT NULL,
            estimated_hours FLOAT,
            message TEXT,
            status VARCHAR DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_service_request_responses_id ON service_request_responses (id)"))

    # emergency_config
    conn.execute(sa.text("""
        CREATE TABLE emergency_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            category VARCHAR UNIQUE NOT NULL,
            callout_fee FLOAT NOT NULL DEFAULT 0.0,
            hourly_rate FLOAT NOT NULL DEFAULT 0.0,
            updated_by UUID REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_config_id ON emergency_config (id)"))

    # emergency_penalty_config
    conn.execute(sa.text("""
        CREATE TABLE emergency_penalty_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type VARCHAR UNIQUE NOT NULL,
            star_deduction FLOAT NOT NULL DEFAULT 0.5,
            updated_by UUID REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_penalty_config_id ON emergency_penalty_config (id)"))

    # emergency_requests
    conn.execute(sa.text("""
        CREATE TABLE emergency_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id),
            society_name VARCHAR NOT NULL,
            building_name VARCHAR NOT NULL,
            flat_no VARCHAR NOT NULL,
            landmark VARCHAR NOT NULL,
            full_address TEXT NOT NULL,
            category VARCHAR NOT NULL,
            description TEXT NOT NULL,
            device_name VARCHAR,
            photos TEXT,
            contact_name VARCHAR NOT NULL,
            contact_phone VARCHAR NOT NULL,
            status VARCHAR NOT NULL DEFAULT 'PENDING',
            config_id UUID REFERENCES emergency_config(id),
            expires_at TIMESTAMP NOT NULL,
            resulting_booking_id UUID REFERENCES service_bookings(id),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_requests_id ON emergency_requests (id)"))
    conn.execute(sa.text("CREATE INDEX ix_emergency_requests_status ON emergency_requests (status)"))

    # emergency_responses
    conn.execute(sa.text("""
        CREATE TABLE emergency_responses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            request_id UUID NOT NULL REFERENCES emergency_requests(id),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            arrival_time TIMESTAMP NOT NULL,
            status VARCHAR NOT NULL DEFAULT 'PENDING',
            penalty_count INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_responses_id ON emergency_responses (id)"))
    conn.execute(sa.text("CREATE INDEX ix_emergency_responses_status ON emergency_responses (status)"))

    # emergency_star_adjustments
    conn.execute(sa.text("""
        CREATE TABLE emergency_star_adjustments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            provider_id UUID NOT NULL REFERENCES service_providers(id),
            adjusted_by UUID NOT NULL REFERENCES users(id),
            delta FLOAT NOT NULL,
            reason TEXT NOT NULL,
            event_type VARCHAR NOT NULL,
            emergency_request_id UUID REFERENCES emergency_requests(id),
            created_at TIMESTAMP DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_emergency_star_adjustments_id ON emergency_star_adjustments (id)"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_star_adjustments CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_penalty_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS emergency_config CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_responses CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_request_recipients CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_requests CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS notifications CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS maintenance_tasks CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_reviews CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_chats CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS booking_status_history CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_bookings CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_certificates CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS society_trusted_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS service_providers CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS societies CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))
