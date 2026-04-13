import uuid
import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class SecretaryComplaint(Base):
    __tablename__ = "secretary_complaints"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=False, index=True)
    filed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="OPEN")   # OPEN | UNDER_REVIEW | RESOLVED
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    society = relationship("Society", foreign_keys=[society_id])
    secretary = relationship("User", foreign_keys=[filed_by])


class HomeMember(Base):
    __tablename__ = "home_members"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    family_members = Column(Integer, nullable=False)
    house_no = Column(String(100), nullable=False)
    mobile = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
