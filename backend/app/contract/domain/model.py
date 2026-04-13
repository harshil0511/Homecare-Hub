import uuid
import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from app.core.db.base import Base


class SocietyContract(Base):
    __tablename__ = "society_contracts"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=False)
    provider_id = Column(PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False)
    proposed_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    duration_months = Column(Integer, nullable=False)
    counter_duration_months = Column(Integer, nullable=True)
    monthly_rate = Column(Float, nullable=False)
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    status = Column(String, default="PENDING")
    secretary_notes = Column(Text, nullable=True)
    servicer_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow,
                        onupdate=datetime.datetime.utcnow)

    society = relationship("Society")
    provider = relationship("ServiceProvider")
    proposed_by_user = relationship("User", foreign_keys=[proposed_by])
    dispatches = relationship(
        "SocietyDispatch", back_populates="contract", cascade="all, delete-orphan"
    )


class SocietyDispatch(Base):
    __tablename__ = "society_dispatches"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    contract_id = Column(
        PG_UUID(as_uuid=True), ForeignKey("society_contracts.id"), nullable=False
    )
    society_id = Column(PG_UUID(as_uuid=True), ForeignKey("societies.id"), nullable=False)
    provider_id = Column(
        PG_UUID(as_uuid=True), ForeignKey("service_providers.id"), nullable=False
    )
    member_id = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    service_type = Column(String, nullable=False)
    scheduled_at = Column(DateTime, nullable=False)
    job_price = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    status = Column(String, default="ASSIGNED")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    contract = relationship("SocietyContract", back_populates="dispatches")
    provider = relationship("ServiceProvider")
    member = relationship("User", foreign_keys=[member_id])
