from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SCHOLARAi API"
    VERSION: str = "0.4.0"
    PHASE: str = "Phase 1 — Foundation"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Database URL: default SQLite for local development, migratable to PostgreSQL
    DATABASE_URL: str = "sqlite:///./scholarai.db"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

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
    AI_TIMEOUT_SECONDS: float = 30.0

    # Gemini AI Configuration
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"

    # CORS configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [str(v)]

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            # 1. Reject default dev secret in production
            if self.AUTH_SECRET == "dev-secret-key-change-in-production-scholarai-2026":
                raise ValueError(
                    "CRITICAL SECURITY ERROR: AUTH_SECRET must be configured with a strong, random secret in production! "
                    "Cannot use the default development key."
                )
            # 2. Reject wildcard CORS in production
            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    "CRITICAL SECURITY ERROR: Wildcard '*' CORS origin is not permitted in production with credentials. "
                    "Specify exact allowed frontend domain(s) in CORS_ORIGINS."
                )
            # 3. If real AI provider is selected, ensure API key is present
            provider_type = self.AI_PROVIDER.lower().strip()
            if provider_type == "gemini":
                if not (self.GEMINI_API_KEY.strip() or self.AI_API_KEY.strip()):
                    raise ValueError(
                        "AI Configuration Error: AI_PROVIDER is set to 'gemini', but GEMINI_API_KEY is empty."
                    )
            elif provider_type != "demo" and not self.AI_API_KEY.strip():
                raise ValueError(
                    f"AI Configuration Error: AI_PROVIDER is set to '{self.AI_PROVIDER}', but AI_API_KEY is empty."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
