import re
import ipaddress
from urllib.parse import urlparse
from typing import Tuple

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"disregard\s+(all\s+)?(previous|prior)\s+instructions",
    r"reveal\s+(system\s+)?(prompt|instructions|user\s+data|secrets)",
    r"bypass\s+(safety|filters|rules)",
    r"you\s+are\s+now\s+in\s+(jailbreak|developer|dan)\s+mode",
]


def sanitize_untrusted_content(text: str) -> str:
    """
    Sanitize untrusted content retrieved from external sources or user prompts.
    Ensures instruction override attempts are defanged into inert text.
    """
    if not text:
        return ""

    sanitized = text
    for pattern in INJECTION_PATTERNS:
        sanitized = re.sub(pattern, "[UNTRUSTED_INSTRUCTION_DEFANGED]", sanitized, flags=re.IGNORECASE)

    return sanitized


def validate_safe_url(url: str) -> Tuple[bool, str]:
    """
    Validate that a URL is safe to retrieve (SSRF defense).
    Blocks private IP spaces, localhost, non-http(s) schemes, and internal hostnames.
    """
    if not url:
        return False, "URL cannot be empty"

    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, f"Unsupported URL scheme: {parsed.scheme}. Only HTTP and HTTPS are permitted."

        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid URL: missing hostname"

        # Check for localhost
        if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return False, "Access to localhost and internal loopback addresses is strictly forbidden."

        # Check for private IP addresses
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
                return False, "Access to private or reserved IP networks is strictly forbidden."
        except ValueError:
            # Hostname is a domain name, not an IP
            pass

        return True, "URL is safe"
    except Exception as e:
        return False, f"Malformed URL: {str(e)}"
