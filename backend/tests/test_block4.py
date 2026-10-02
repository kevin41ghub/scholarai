import pytest
from pydantic import ValidationError
from app.core.config import Settings
from app.services.ai.provider import (
    DemoAIProvider,
    OpenAICompatibleProvider,
    get_ai_provider,
)


def test_production_security_rejects_default_secret():
    """Verify that in production, using the default development AUTH_SECRET raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            AUTH_SECRET="dev-secret-key-change-in-production-scholarai-2026",
            CORS_ORIGINS=["https://scholarai.example.com"],
        )
    assert "AUTH_SECRET must be configured with a strong, random secret in production" in str(exc_info.value)


def test_production_security_rejects_wildcard_cors():
    """Verify that in production, wildcard '*' CORS origin raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            AUTH_SECRET="a-very-secure-random-production-secret-key-64-bytes-long",
            CORS_ORIGINS=["*"],
        )
    assert "Wildcard '*' CORS origin is not permitted in production with credentials" in str(exc_info.value)


def test_production_security_requires_real_ai_api_key():
    """Verify that in production, selecting a real AI provider without an API key raises ValidationError."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            AUTH_SECRET="a-very-secure-random-production-secret-key-64-bytes-long",
            CORS_ORIGINS=["https://scholarai.example.com"],
            AI_PROVIDER="openai",
            AI_API_KEY="",
        )
    assert "AI_PROVIDER is set to 'openai', but AI_API_KEY is empty" in str(exc_info.value)


def test_database_url_normalization():
    """Verify postgres:// is rewritten to postgresql:// for SQLAlchemy 2.0 compatibility."""
    s = Settings(
        DATABASE_URL="postgres://user:password@localhost:5432/scholarai",
        ENVIRONMENT="development"
    )
    assert s.DATABASE_URL.startswith("postgresql://")


def test_openai_compatible_provider_validation():
    """Verify that OpenAICompatibleProvider validates API key and parameters."""
    with pytest.raises(ValueError) as exc:
        OpenAICompatibleProvider(api_key="")
    assert "requires a non-empty AI_API_KEY" in str(exc.value)

    provider = OpenAICompatibleProvider(
        api_key="sk-test-mock-key-12345",
        model_name="gpt-4o-mini",
        base_url="https://api.groq.com/openai/v1"
    )
    assert provider.model_name == "gpt-4o-mini"
    assert provider.base_url == "https://api.groq.com/openai/v1"
    assert provider._headers()["Authorization"] == "Bearer sk-test-mock-key-12345"


def test_get_ai_provider_factory(monkeypatch):
    """Verify get_ai_provider returns DemoAIProvider when configured for demo or empty key."""
    # Demo mode
    p_demo = get_ai_provider()
    assert isinstance(p_demo, DemoAIProvider)

    # Real provider
    from app.core import config
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(config.settings, "AI_API_KEY", "sk-mock-key-for-test")
    monkeypatch.setattr(config.settings, "AI_MODEL", "gpt-4o-mini")

    p_real = get_ai_provider()
    assert isinstance(p_real, OpenAICompatibleProvider)
    assert p_real.model_name == "gpt-4o-mini"


def test_ai_secret_redaction():
    """Verify that provider error handling never exposes secret API keys."""
    provider = OpenAICompatibleProvider(
        api_key="super-secret-api-key-do-not-leak",
        base_url="http://127.0.0.1:9999",  # unreachable port
        timeout=1.0
    )
    with pytest.raises(RuntimeError) as exc_info:
        provider.generate(prompt="Hello")
    
    err_msg = str(exc_info.value)
    # The actual secret must NOT appear anywhere in the error message
    assert "super-secret-api-key-do-not-leak" not in err_msg
    assert "[REDACTED_API_KEY]" in err_msg or "error" in err_msg.lower()
