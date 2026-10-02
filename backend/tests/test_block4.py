import pytest
from pydantic import ValidationError
from app.core.config import Settings
from app.services.ai.provider import (
    DemoAIProvider,
    OpenAICompatibleProvider,
    GeminiProvider,
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

    with pytest.raises(ValidationError) as exc_info_gemini:
        Settings(
            ENVIRONMENT="production",
            AUTH_SECRET="a-very-secure-random-production-secret-key-64-bytes-long",
            CORS_ORIGINS=["https://scholarai.example.com"],
            AI_PROVIDER="gemini",
            GEMINI_API_KEY="",
            AI_API_KEY="",
        )
    assert "AI_PROVIDER is set to 'gemini', but GEMINI_API_KEY is empty" in str(exc_info_gemini.value)


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


def test_gemini_provider_validation():
    """Verify that GeminiProvider validates API key and parameters."""
    with pytest.raises(ValueError) as exc:
        GeminiProvider(api_key="")
    assert "requires a non-empty GEMINI_API_KEY" in str(exc.value)

    provider = GeminiProvider(
        api_key="AIzaSyMockKeyForGeminiTest1234567890",
        model_name="gemini-flash-latest",
    )
    assert provider.model_name == "gemini-flash-latest"
    assert provider.api_key == "AIzaSyMockKeyForGeminiTest1234567890"


def test_get_ai_provider_factory(monkeypatch):
    """Verify get_ai_provider returns DemoAIProvider when configured for demo or empty key, and real providers when configured."""
    from app.core import config

    # Demo mode
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "demo")
    p_demo = get_ai_provider()
    assert isinstance(p_demo, DemoAIProvider)

    # OpenAI provider
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(config.settings, "AI_API_KEY", "sk-mock-key-for-test")
    monkeypatch.setattr(config.settings, "AI_MODEL", "gpt-4o-mini")

    p_openai = get_ai_provider()
    assert isinstance(p_openai, OpenAICompatibleProvider)
    assert p_openai.model_name == "gpt-4o-mini"

    # Gemini provider
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "gemini")
    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "mock-gemini-key")
    monkeypatch.setattr(config.settings, "GEMINI_MODEL", "gemini-flash-latest")

    p_gemini = get_ai_provider()
    assert isinstance(p_gemini, GeminiProvider)
    assert p_gemini.model_name == "gemini-flash-latest"

    # Gemini fallback to demo if key is empty
    monkeypatch.setattr(config.settings, "GEMINI_API_KEY", "")
    monkeypatch.setattr(config.settings, "AI_API_KEY", "")
    p_fallback = get_ai_provider()
    assert isinstance(p_fallback, DemoAIProvider)


def test_ai_secret_redaction():
    """Verify that provider error handling never exposes secret API keys."""
    # OpenAI provider redaction
    provider = OpenAICompatibleProvider(
        api_key="super-secret-api-key-do-not-leak",
        base_url="http://127.0.0.1:9999",  # unreachable port
        timeout=1.0
    )
    with pytest.raises(RuntimeError) as exc_info:
        provider.generate(prompt="Hello")
    
    err_msg = str(exc_info.value)
    assert "super-secret-api-key-do-not-leak" not in err_msg
    assert "[REDACTED_API_KEY]" in err_msg or "error" in err_msg.lower()

    # Gemini provider redaction
    gemini_secret = "AIzaSySecretDoNotEverExposeInLogsOrMessages"
    gemini_prov = GeminiProvider(api_key=gemini_secret, model_name="gemini-flash-latest")

    # Test _sanitize_error method
    sanitized = gemini_prov._sanitize_error(f"Error connecting with key {gemini_secret}")
    assert gemini_secret not in sanitized
    assert "[REDACTED_API_KEY]" in sanitized
