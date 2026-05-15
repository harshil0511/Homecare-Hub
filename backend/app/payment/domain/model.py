import uuid
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.db.base import Base


class PaymentProfile(Base):
    __tablename__ = "payment_profiles"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    account_holder_name: Mapped[str] = mapped_column(String(60), nullable=False)
    account_number_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    account_number_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    ifsc_code: Mapped[str] = mapped_column(String(30), nullable=False)
    branch: Mapped[str] = mapped_column(String(100), nullable=False)
    upi_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    upi_qr_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="payment_profile")
