from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SCHOLARAi API"
    VERSION: str = "0.1.0"
    PHASE: str = "Phase 1 — Foundation"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Database URL: default SQLite for local development, migratable to PostgreSQL
    DATABASE_URL: str = "sqlite:///./scholarai.db"

    # Authentication & Session Security
    AUTH_SECRET: str = "dev-secret-key-change-in-production-scholarai-2026"
    SESSION_COOKIE_NAME: str = "scholarai_session"
    SESSION_MAX_AGE_SECONDS: int = 86400 * 7
    DEMO_USER_EMAIL: str = "demo@scholarai.local"
    DEMO_USER_PASSWORD: str = "DemoStudent@2026"

    # AI Provider Configuration (Default: demo mode if API key is empty)
    AI_PROVIDER: str = "demo"
    AI_API_KEY: str = ""
    AI_MODEL: str = "demo-scholar-v1"
    AI_BASE_URL: str = ""

    # CORS configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [str(v)]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
