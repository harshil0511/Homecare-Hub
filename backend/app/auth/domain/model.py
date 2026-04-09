import uuid
import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base

society_trusted_providers = Table(
    "society_trusted_providers",
    Base.metadata,
    Column("society_id", PG_UUID(as_uuid=True), ForeignKey("societies.id"), primary_key=True),
    Column("provider_id", PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), primary_key=True),
    Column("created_at", DateTime, default=datetime.datetime.utcnow)
)


class User(Base):
    __tablename__ = "users"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="USER")

    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=True)
    home_number = Column(String, nullable=True)
    resident_name = Column(String, nullable=True)

    society = relationship("Society", back_populates="users", foreign_keys="[User.society_id]")
    tasks = relationship("MaintenanceTask", back_populates="owner")
    bookings = relationship("ServiceBooking", back_populates="user")
    provider_profile = relationship("ServiceProvider", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")
    service_requests = relationship("ServiceRequest", back_populates="user")
    emergency_requests = relationship("EmergencyRequest", back_populates="user")


class Society(Base):
    __tablename__ = "societies"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, unique=True, index=True)
    address = Column(String)
    secretary_name = Column(String, nullable=True)
    is_legal = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    creator_role = Column(String, default="OWNER")
    registration_number = Column(String, unique=True, nullable=True)

    owner_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    secretary_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    manager_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    users = relationship("User", back_populates="society", foreign_keys="[User.society_id]")
    service_providers = relationship("ServiceProvider", back_populates="society")
    trusted_providers = relationship(
        "ServiceProvider",
        secondary=society_trusted_providers,
        backref="trusted_by_societies"
    )
    requests = relationship("SocietyRequest", back_populates="society")
    owner_user = relationship("User", foreign_keys=[owner_id])
    secretary_user = relationship("User", foreign_keys=[secretary_id])
    manager_user = relationship("User", foreign_keys=[manager_id])
