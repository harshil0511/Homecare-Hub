import re
from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, field_validator


IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
ACCOUNT_NUMBER_RE = re.compile(r"^\d{9,18}$")
UPI_RE = re.compile(r"^.+@.+$")


class UserPaymentProfileCreate(BaseModel):
    account_holder_name: str
    account_number: str
    ifsc_code: str
    branch: str

    @field_validator("account_holder_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not (2 <= len(v) <= 60):
            raise ValueError("Account holder name must be 2–60 characters")
        if not re.match(r"^[A-Za-z ]+$", v):
            raise ValueError("Account holder name must contain only letters and spaces")
        return v

    @field_validator("account_number")
    @classmethod
    def validate_account_number(cls, v: str) -> str:
        if not ACCOUNT_NUMBER_RE.match(v):
            raise ValueError("Account number must be 9–18 digits")
        return v

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        v = v.upper().strip()
        if not v:
            raise ValueError("IFSC code is required")
        return v

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: str) -> str:
        v = v.strip()
        if not (1 <= len(v) <= 100):
            raise ValueError("Branch must be 1–100 characters")
        return v


class ProviderPaymentProfileCreate(UserPaymentProfileCreate):
    upi_id: Optional[str] = None
    upi_qr_image_url: Optional[str] = None

    @field_validator("upi_id")
    @classmethod
    def validate_upi(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not UPI_RE.match(v):
                raise ValueError("UPI ID must be in format name@bank")
        return v


class PaymentProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    account_holder_name: str
    account_number_masked: str
    ifsc_code: str
    branch: str
    upi_id: Optional[str] = None
    upi_qr_image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProviderPaymentStatusRead(BaseModel):
    provider_id: str
    has_payment_profile: bool


class ProviderPayDetailsRead(BaseModel):
    account_holder_name: str
    account_number_masked: str
    account_number_last4: str
    ifsc_code: str
    upi_id: Optional[str] = None
    upi_qr_image_url: Optional[str] = None
    has_upi: bool
    has_qr: bool
