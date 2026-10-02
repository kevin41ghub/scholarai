import logging
import json
import httpx
from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """
    Abstract AI Provider Interface.
    Enables pluggable LLM backends (OpenAI, Groq, Gemini, Ollama, or Local/Demo fallback).
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
        val = sum(ord(c) for c in text[:32]) % 100 / 100.0
        return [val] * 64


class OpenAICompatibleProvider(AIProvider):
    """
    Production-ready AI Provider supporting OpenAI, Groq, Mistral, Together,
    Perplexity, DeepSeek, Google Gemini (OpenAI compatibility endpoint), or Ollama.
    Communicates via standard HTTP REST API with strict timeouts and secret redaction.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "gpt-4o-mini",
        base_url: str = "https://api.openai.com/v1",
        timeout: float = 30.0,
    ):
        if not api_key or not api_key.strip():
            raise ValueError("Real AI provider requires a non-empty AI_API_KEY")

        self.api_key = api_key.strip()
        self.model_name = model_name or "gpt-4o-mini"
        self.base_url = (base_url or "https://api.openai.com/v1").rstrip("/")
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model_name,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.3),
            "max_tokens": kwargs.get("max_tokens", 800),
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            # Redact secrets from error logs
            safe_err = str(e).replace(self.api_key, "[REDACTED_API_KEY]")
            logger.error(f"AI Provider generate request failed: {safe_err}")
            raise RuntimeError(f"AI provider communication error: {safe_err}")

    def summarize(self, text: str, max_words: int = 100) -> str:
        sys_prompt = (
            f"You are SCHOLARAi's academic summarization assistant. "
            f"Summarize the provided text in under {max_words} words. "
            f"Ground your answer strictly in the provided text. Never invent facts."
        )
        return self.generate(prompt=text, system_prompt=sys_prompt)

    def classify(self, text: str, categories: List[str]) -> str:
        categories_str = ", ".join(categories)
        sys_prompt = (
            f"Classify the input text into exactly ONE of these categories: [{categories_str}]. "
            f"Respond with ONLY the exact matching category name and nothing else."
        )
        result = self.generate(prompt=text, system_prompt=sys_prompt).strip()
        for cat in categories:
            if cat.lower() in result.lower():
                return cat
        return categories[0] if categories else "OTHER"

    def extract(self, text: str, schema_description: str) -> Dict[str, Any]:
        sys_prompt = (
            f"Extract structured information from the input text matching this schema: {schema_description}. "
            f"Respond with strictly valid JSON only. Do not include markdown codeblocks or explanation."
        )
        output = self.generate(prompt=text, system_prompt=sys_prompt).strip()
        try:
            if output.startswith("```"):
                output = output.strip("`")
                if output.startswith("json"):
                    output = output[4:]
            return json.loads(output.strip())
        except Exception as e:
            logger.warning(f"Failed to parse JSON extracted by AI: {e}")
            return {"raw_extraction": output, "status": "PARSE_ERROR"}

    def embed(self, text: str) -> List[float]:
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.base_url}/embeddings",
                    headers=self._headers(),
                    json={
                        "model": "text-embedding-3-small",
                        "input": text,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["data"][0]["embedding"]
        except Exception as e:
            safe_err = str(e).replace(self.api_key, "[REDACTED_API_KEY]")
            logger.warning(f"AI Provider embedding request failed, using fallback vector: {safe_err}")

        # Deterministic fallback vector
        val = sum(ord(c) for c in text[:32]) % 100 / 100.0
        return [val] * 64


def get_ai_provider() -> AIProvider:
    """
    Factory function returning configured AI provider.
    Defaults safely to DemoAIProvider if no API key is present or AI_PROVIDER == 'demo'.
    Instantiates OpenAICompatibleProvider when a real provider and API key are configured.
    """
    provider_type = settings.AI_PROVIDER.lower().strip()
    api_key = settings.AI_API_KEY.strip()

    if provider_type == "demo" or not api_key:
        return DemoAIProvider(model_name=settings.AI_MODEL)

    if provider_type in ("openai", "groq", "openai_compatible", "generic", "together", "deepseek", "gemini"):
        base_url = settings.AI_BASE_URL.strip() or "https://api.openai.com/v1"
        logger.info(f"Using active AI provider: {provider_type} (model: {settings.AI_MODEL}) at {base_url}")
        return OpenAICompatibleProvider(
            api_key=api_key,
            model_name=settings.AI_MODEL or "gpt-4o-mini",
            base_url=base_url,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )

    logger.warning(f"Unknown AI_PROVIDER '{provider_type}'. Falling back to DemoAIProvider.")
    return DemoAIProvider(model_name=settings.AI_MODEL)
