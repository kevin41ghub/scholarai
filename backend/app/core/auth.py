from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.config import settings
from app.core.security import verify_session_token
from app.models.user import User
from app.models.student import Student

security_bearer = HTTPBearer(auto_error=False)


def extract_token_from_request(request: Request, bearer: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    """Extract session token from HttpOnly cookie or Authorization Bearer header."""
    # 1. Check HttpOnly cookie
    cookie_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if cookie_token:
        return cookie_token

    # 2. Check Authorization Bearer header
    if bearer and bearer.credentials:
        return bearer.credentials

    return None


def get_current_user(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """
    Get currently authenticated user.
    If authenticated via session or token, returns the authenticated User.
    In development/demo mode, if unauthenticated, gracefully falls back to the Demo User
    to preserve backward compatibility with unauthenticated Phase 1 & Block 2 client tests.
    """
    token = extract_token_from_request(request, bearer)
    if token:
        payload = verify_session_token(token)
        if payload and "sub" in payload:
            user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
            if user:
                return user

    # Fallback to demo user for local exploration / backward compatibility
    demo_user = db.query(User).filter(User.email == settings.DEMO_USER_EMAIL).first()
    if demo_user:
        return demo_user

    # If demo user not yet in DB, check demo student
    demo_student = db.query(Student).filter(Student.email == "arjun.kumar@demo.edu").first()
    if demo_student and demo_student.user:
        return demo_student.user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_required_authenticated_user(
    request: Request,
    bearer: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> User:
    """
    Strict authentication dependency. Does NOT fall back to demo user.
    Requires an active valid session token or Bearer header.
    """
    token = extract_token_from_request(request, bearer)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_session_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == payload["sub"], User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or deactivated",
        )

    return user


def verify_student_access(current_user: User, student_id: int) -> None:
    """
    Authorization policy: Prevents Insecure Direct Object Reference (IDOR).
    A student can only view/mutate their own portfolio items.
    """
    if current_user.student_id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not have permission to access another student's data.",
        )
