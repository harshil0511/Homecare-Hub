from uuid import UUID
from pydantic import BaseModel
from typing import Optional

from app.api.auth.schemas import UserResponse  # noqa: F401
from app.api.service.schemas import SocietyResponse, SocietyUpdate, ProviderResponse  # noqa: F401


class HomeAssign(BaseModel):
    home_number: str
    resident_name: str
