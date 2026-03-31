from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    SUPERADMIN_EMAIL: str
    SUPERADMIN_PASSWORD: str
    SUPERADMIN_USERNAME: str = "Super Admin"
    FRONTEND_URL: str = "http://localhost:3000"  # Override in .env for production
    ANTHROPIC_API_KEY: str = ""  # Set this in .env

    model_config = ConfigDict(env_file=".env")

settings = Settings()
