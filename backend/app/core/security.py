import hmac
import hashlib
import secrets
import json
import base64
import time
from typing import Optional, Dict, Any, Tuple
from app.core.config import settings

PBKDF2_ITERATIONS = 600_000


def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Hash a password securely using PBKDF2-HMAC-SHA256 with 600,000 iterations.
    Returns (hex_hash, hex_salt).
    """
    if not salt:
        salt = secrets.token_hex(16)
    
    hash_bytes = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ITERATIONS
    )
    return hash_bytes.hex(), salt


def verify_password(plain_password: str, password_hash: str, salt: str) -> bool:
    """
    Verify a password against stored hash and salt using constant-time comparison.
    """
    calculated_hash, _ = hash_password(plain_password, salt=salt)
    return hmac.compare_digest(calculated_hash, password_hash)


def create_session_token(user_id: int, email: str) -> str:
    """
    Create a signed session token containing user_id, email, issue timestamp, and expiration.
    Format: base64(payload_json).signature_hex
    """
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + settings.SESSION_MAX_AGE_SECONDS
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")
    
    signature = hmac.new(
        settings.AUTH_SECRET.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    return f"{payload_b64}.{signature}"


def verify_session_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Verify signature and expiration of a session token.
    Returns payload dictionary if valid, None otherwise.
    """
    if not token or "." not in token:
        return None
    
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        
        payload_b64, signature = parts
        
        expected_sig = hmac.new(
            settings.AUTH_SECRET.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(expected_sig, signature):
            return None
        
        # Add padding back if necessary
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += "=" * padding
            
        payload_json = base64.urlsafe_b64decode(payload_b64.encode("utf-8")).decode("utf-8")
        payload = json.loads(payload_json)
        
        # Check expiration
        now = int(time.time())
        if payload.get("exp", 0) < now:
            return None
            
        return payload
    except Exception:
        return None
