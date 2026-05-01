from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator

class Settings(BaseSettings):
    DATABASE_URL: str

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        # Render provides postgresql:// — psycopg3 requires postgresql+psycopg://
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    SUPERADMIN_EMAIL: str
    SUPERADMIN_PASSWORD: str
    SUPERADMIN_USERNAME: str = "Super Admin"
    FRONTEND_URL: str = "http://localhost:3000"  # Override in .env for production
    ANTHROPIC_API_KEY: str = ""  # Set this in .env
    PAYMENT_ENCRYPTION_KEY: str = ""

    model_config = ConfigDict(env_file=".env")

settings = Settings()
