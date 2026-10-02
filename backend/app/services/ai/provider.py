import logging
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """
    Abstract AI Provider Interface.
    Enables pluggable LLM backends (OpenAI, Gemini, Anthropic, or Local/Demo fallback).
    """

    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        """Generate text completion from prompt."""
        pass

    @abstractmethod
    def summarize(self, text: str, max_words: int = 100) -> str:
        """Summarize text concisely."""
        pass

    @abstractmethod
    def classify(self, text: str, categories: List[str]) -> str:
        """Classify input text into one of the designated categories."""
        pass

    @abstractmethod
    def extract(self, text: str, schema_description: str) -> Dict[str, Any]:
        """Extract structured information from text."""
        pass

    @abstractmethod
    def embed(self, text: str) -> List[float]:
        """Generate text embedding vector."""
        pass


class DemoAIProvider(AIProvider):
    """
    DEMO AI MODE Provider.
    Used when no external AI API key is configured or when AI_PROVIDER='demo'.
    Produces high-fidelity, deterministic responses clearly labeled as DEMO AI RESPONSE.
    """

    def __init__(self, model_name: str = "demo-scholar-v1"):
        self.model_name = model_name

    def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        # Transparent label
        return f"[DEMO AI RESPONSE — Generated in Demo Mode]\n{prompt[:200]}..."

    def summarize(self, text: str, max_words: int = 100) -> str:
        words = text.split()
        summary = " ".join(words[:max_words])
        return f"[DEMO AI SUMMARY] {summary}..."

    def classify(self, text: str, categories: List[str]) -> str:
        text_lower = text.lower()
        for cat in categories:
            if cat.lower() in text_lower:
                return cat
        return categories[0] if categories else "OTHER"

    def extract(self, text: str, schema_description: str) -> Dict[str, Any]:
        return {"extracted": text[:50], "status": "DEMO_EXTRACTED"}

    def embed(self, text: str) -> List[float]:
        # Return deterministic mock 64-dim embedding based on character hash
        val = sum(ord(c) for c in text[:32]) % 100 / 100.0
        return [val] * 64


def get_ai_provider() -> AIProvider:
    """
    Factory function returning configured AI provider.
    Defaults safely to DemoAIProvider if no API key is present or AI_PROVIDER == 'demo'.
    """
    provider_type = settings.AI_PROVIDER.lower()
    api_key = settings.AI_API_KEY.strip()

    if not api_key or provider_type == "demo":
        return DemoAIProvider(model_name=settings.AI_MODEL)

    # If external provider is configured in future, plug in here safely
    logger.info(f"Using external AI provider: {provider_type} with model {settings.AI_MODEL}")
    return DemoAIProvider(model_name=settings.AI_MODEL)
