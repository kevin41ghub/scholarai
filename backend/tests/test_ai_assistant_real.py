import pytest
from sqlalchemy.orm import Session
from app.services.ai.provider import check_ai_connectivity, DemoAIProvider, GeminiProvider
from app.services.ai.tools import AIToolkit
from app.models.scholarship import Scholarship, KNOWN_FICTIONAL_DEMO_NAMES, RETIRED_DEMO_STATUSES
from app.models.student import Student


def test_ai_connectivity_demo_mode(monkeypatch):
    """When AI_PROVIDER is demo, check_ai_connectivity returns DEMO_MODE without network calls."""
    from app.core import config
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "demo")

    diag = check_ai_connectivity(timeout_seconds=1.0)
    assert diag["provider"] == "demo"
    assert diag["connectivity"] == "DEMO_MODE"
    assert diag["configured"] is True


def test_ai_connectivity_secret_sanitization():
    """Verify provider error sanitization strictly strips secret API keys."""
    prov = GeminiProvider(api_key="AIzaSyMOCK_DUMMY_KEY_FOR_TESTING_12345", model_name="gemini-flash-latest")
    raw_error_message = "Failed to connect to Google API with key AIzaSyMOCK_DUMMY_KEY_FOR_TESTING_12345 and token sk-secret"
    sanitized = prov._sanitize_error(raw_error_message)

    assert "AIzaSyMOCK_DUMMY_KEY_FOR_TESTING_12345" not in sanitized
    assert "[REDACTED_API_KEY]" in sanitized


def test_ai_toolkit_excludes_retired_demo_scholarships(db_session: Session):
    """AIToolkit scholarship search and details must strictly exclude retired demo records."""
    student = db_session.query(Student).first()
    assert student is not None

    from datetime import datetime, timezone

    # Insert a retired demo scholarship in DB
    retired_demo = Scholarship(
        name="Empower Future Scholarship (Fictional Legacy)",
        provider="Legacy Mock Foundation (Demo)",
        description="Fictional scholarship for legacy test verification.",
        deadline=datetime.now(timezone.utc),
        amount=50000.0,
        currency="INR",
        status="INACTIVE",
        verification_status="RETIRED_DEMO",
    )
    db_session.add(retired_demo)
    db_session.commit()
    db_session.refresh(retired_demo)

    toolkit = AIToolkit(db=db_session, student_id=student.id)

    # 1. Search must not return the retired scholarship
    results = toolkit.search_scholarships(query="Empower", limit=10)
    returned_ids = [r["id"] for r in results]
    assert retired_demo.id not in returned_ids

    # 2. Get details must return None for retired demo scholarship
    details = toolkit.get_scholarship_details(retired_demo.id)
    assert details is None
