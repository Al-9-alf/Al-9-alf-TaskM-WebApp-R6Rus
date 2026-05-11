from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@db:5432/taskmanager"
    SECRET_KEY: str = Field(..., description="Secret key for JWT token generation")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

try:
    settings = Settings()
except Exception:
    import os
    os.environ.setdefault("SECRET_KEY", "dev-secret-change-in-production-immediately")
    settings = Settings()