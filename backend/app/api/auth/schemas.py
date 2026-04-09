from uuid import UUID
from enum import Enum
from pydantic import BaseModel, EmailStr
from typing import Optional


class UserRole(str, Enum):
    USER = "USER"
    SERVICER = "SERVICER"
    ADMIN = "ADMIN"
    SECRETARY = "SECRETARY"


class UserBase(BaseModel):
    email: EmailStr
    username: str
    role: Optional[UserRole] = UserRole.USER


class UserCreate(UserBase):
    password: str
    society_name: Optional[str] = None
    society_address: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: UUID
    is_active: bool
    society_id: Optional[UUID] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_uuid: str
    username: str


class TokenData(BaseModel):
    user_uuid: Optional[str] = None
    role: Optional[str] = None


class ForgotPassword(BaseModel):
    email: EmailStr
    new_password: str


class ChangePassword(BaseModel):
    current_password: str
    new_password: str
