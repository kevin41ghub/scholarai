import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import get_db
from app.db.init_db import init_db
from app.main import app

from sqlalchemy.pool import StaticPool

# In-memory SQLite for testing isolation with StaticPool
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    init_db(session)
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Override get_db with test database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_client(client, db_session):
    """TestClient with an authenticated session for the seeded demo user."""
    from app.core.security import create_session_token
    from app.core.config import settings
    from app.models.user import User

    user = db_session.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
    if not user:
        raise RuntimeError("Demo user not found in seeded database")
    token = create_session_token(user_id=user.id, email=user.email)
    client.cookies.set(settings.SESSION_COOKIE_NAME, token)
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture(scope="function")
def create_authenticated_client(client, db_session):
    """Factory fixture to create an authenticated client for an arbitrary user."""
    def _create(email: str, name: str = "Test User"):
        from app.core.security import create_session_token, hash_password
        from app.core.config import settings
        from app.models.student import Student
        from app.models.student_profile import StudentProfile
        from app.models.funding_profile import FundingProfile
        from app.models.user import User

        student = Student(name=name, email=email, phone="+91 99999 88888")
        db_session.add(student)
        db_session.flush()

        profile = StudentProfile(
            student_id=student.id,
            institution="Test University",
            course="B.Sc Computer Science",
            year="1st Year",
            cgpa=8.0,
            twelfth_percentage=85.0,
            category="GENERAL",
            state="Karnataka",
            gender="Female",
        )
        db_session.add(profile)

        funding = FundingProfile(
            student_id=student.id,
            annual_education_cost=100000.0,
            existing_support=50000.0,
            annual_family_income=300000.0,
        )
        db_session.add(funding)

        pwd_hash, salt = hash_password("TestPassword123!")
        user = User(
            email=email.lower(),
            password_hash=pwd_hash,
            salt=salt,
            student_id=student.id,
            is_active=True,
            is_demo=False,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        db_session.refresh(student)

        token = create_session_token(user_id=user.id, email=user.email)
        
        user_client = TestClient(app)
        user_client.cookies.set(settings.SESSION_COOKIE_NAME, token)
        user_client.headers.update({"Authorization": f"Bearer {token}"})
        return user_client, user, student

    return _create


@pytest.fixture(autouse=True)
def default_demo_ai_provider(monkeypatch):
    """Ensure test suite defaults safely to DemoAIProvider without making external API calls."""
    from app.core import config
    monkeypatch.setattr(config.settings, "AI_PROVIDER", "demo")
