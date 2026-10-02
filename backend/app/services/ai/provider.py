import logging
import json
import re
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
    Perplexity, DeepSeek, or Ollama.
    Communicates via standard HTTP REST API with strict timeouts and secret redaction.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "gpt-4o-mini",
        base_url: str = "https://api.openai.com/v1",
        timeout: float = 30.0,
    ):
        clean_key = (api_key or "").strip(" \"'")
        if not clean_key:
            raise ValueError("Real AI provider requires a non-empty AI_API_KEY")

        self.api_key = clean_key
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


class GeminiProvider(AIProvider):
    """
    Official Google Gemini AI Provider using the google-genai SDK.
    Supports official Google Gemini models (e.g. gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash).
    Follows AIProvider abstraction, enforces prompt grounding, and redacts secrets in error logs.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "gemini-flash-latest",
        timeout: float = 30.0,
    ):
        clean_key = (api_key or "").strip(" \"'")
        if not clean_key:
            raise ValueError("Gemini AI provider requires a non-empty GEMINI_API_KEY")

        self.api_key = clean_key
        self.model_name = (model_name or "gemini-flash-latest").strip(" \"'")
        self.timeout = timeout
        self._client = None

        try:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        except Exception as e:
            logger.warning(f"Could not initialize google.genai Client: {self._sanitize_error(e)}")

    def _sanitize_error(self, err: Any) -> str:
        """Strip API keys and sensitive tokens from error messages and logs."""
        msg = str(err)
        if self.api_key:
            msg = msg.replace(self.api_key, "[REDACTED_API_KEY]")
        # Regex to catch any standard Google API key pattern (AIza...)
        msg = re.sub(r"AIza[0-9A-Za-z\-_]{35}", "[REDACTED_API_KEY]", msg)
        return msg

    def generate(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        """Generate text completion from prompt using google-genai SDK or direct REST fallback."""
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        try:
            if self._client is not None:
                from google.genai import types

                config_kwargs: Dict[str, Any] = {
                    "temperature": kwargs.get("temperature", 0.2),
                    "max_output_tokens": kwargs.get("max_tokens", 800),
                }
                if system_prompt:
                    config_kwargs["system_instruction"] = system_prompt

                config = types.GenerateContentConfig(**config_kwargs)
                response = self._client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=config,
                )

                if not response or not response.text:
                    raise RuntimeError("Gemini AI provider returned an empty or malformed response")

                return response.text.strip()
            else:
                return self._generate_rest(prompt, system_prompt=system_prompt, **kwargs)

        except Exception as e:
            safe_err = self._sanitize_error(e)
            err_lower = safe_err.lower()

            # Safe handling for unavailable / deprecated / high-demand models: attempt fallback candidates
            if "404" in err_lower or "503" in err_lower or "not_found" in err_lower or "no longer available" in err_lower or "high demand" in err_lower or "unavailable" in err_lower or "not found" in err_lower:
                fallback_candidates = ["gemini-flash-latest", "gemini-3-flash-preview"]
                for candidate in fallback_candidates:
                    if candidate == self.model_name:
                        continue
                    logger.warning(
                        f"Configured Gemini model '{self.model_name}' encountered {safe_err[:120]}. "
                        f"Attempting fallback to '{candidate}'."
                    )
                    try:
                        if self._client is not None:
                            from google.genai import types

                            config_kwargs: Dict[str, Any] = {
                                "temperature": kwargs.get("temperature", 0.2),
                                "max_output_tokens": kwargs.get("max_tokens", 800),
                            }
                            if system_prompt:
                                config_kwargs["system_instruction"] = system_prompt

                            config = types.GenerateContentConfig(**config_kwargs)
                            response = self._client.models.generate_content(
                                model=candidate,
                                contents=prompt,
                                config=config,
                            )
                            if response and response.text:
                                self.model_name = candidate
                                return response.text.strip()
                    except Exception as fallback_err:
                        safe_fallback_err = self._sanitize_error(fallback_err)
                        logger.warning(f"Fallback candidate '{candidate}' also failed: {safe_fallback_err}")

            if "401" in err_lower or "api_key_invalid" in err_lower or "invalid api key" in err_lower:
                logger.error(f"Gemini API authentication failed (invalid API key): {safe_err}")
                raise RuntimeError("Gemini AI provider authentication failed: invalid or unauthorized API key.")
            elif "429" in err_lower or "quota" in err_lower or "resource_exhausted" in err_lower:
                logger.error(f"Gemini API rate limit or quota exceeded: {safe_err}")
                raise RuntimeError("Gemini AI provider quota or rate limit exceeded. Please try again later.")
            elif "404" in err_lower or "not_found" in err_lower or ("model" in err_lower and "not found" in err_lower):
                logger.error(f"Gemini model '{self.model_name}' unavailable or not found: {safe_err}")
                raise RuntimeError(f"Gemini model '{self.model_name}' is unavailable or not found.")
            elif "timeout" in err_lower or "timed out" in err_lower or "connect" in err_lower:
                logger.error(f"Gemini API network timeout: {safe_err}")
                raise RuntimeError("Gemini AI provider network connection timed out.")
            elif "empty or malformed" in err_lower:
                logger.error(f"Gemini API returned empty response: {safe_err}")
                raise RuntimeError("Gemini AI provider returned an empty or malformed response.")
            else:
                logger.error(f"Gemini API generate error: {safe_err}")
                raise RuntimeError(f"Gemini AI provider communication error: {safe_err}")

    def _generate_rest(self, prompt: str, system_prompt: Optional[str] = None, **kwargs) -> str:
        """Direct REST fallback to Google Generative Language API using httpx."""
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent"
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }
        parts = [{"text": prompt}]
        contents = [{"parts": parts}]
        body: Dict[str, Any] = {"contents": contents}

        if system_prompt:
            body["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        generation_config: Dict[str, Any] = {
            "temperature": kwargs.get("temperature", 0.2),
            "maxOutputTokens": kwargs.get("max_tokens", 800),
        }
        body["generationConfig"] = generation_config

        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("Gemini REST API returned no candidates")
            parts_out = candidates[0].get("content", {}).get("parts", [])
            if not parts_out or "text" not in parts_out[0]:
                raise RuntimeError("Gemini REST API returned empty content")
            return parts_out[0]["text"].strip()

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
            logger.warning(f"Failed to parse JSON extracted by Gemini AI: {e}")
            return {"raw_extraction": output, "status": "PARSE_ERROR"}

    def embed(self, text: str) -> List[float]:
        try:
            if self._client is not None:
                resp = self._client.models.embed_content(
                    model="text-embedding-004",
                    contents=text,
                )
                if resp and resp.embedding and resp.embedding.values:
                    return list(resp.embedding.values)
        except Exception as e:
            logger.warning(f"Gemini embedding failed, using fallback vector: {self._sanitize_error(e)}")

        val = sum(ord(c) for c in text[:32]) % 100 / 100.0
        return [val] * 64


def get_ai_provider() -> AIProvider:
    """
    Factory function returning configured AI provider.
    Defaults safely to DemoAIProvider if no API key is present or AI_PROVIDER == 'demo'.
    Instantiates GeminiProvider when AI_PROVIDER == 'gemini'.
    Instantiates OpenAICompatibleProvider when OpenAI or compatible provider is configured.
    """
    provider_type = settings.AI_PROVIDER.lower().strip()

    if provider_type == "gemini":
        gemini_key = (settings.GEMINI_API_KEY or settings.AI_API_KEY).strip(" \"'")
        gemini_model = (settings.GEMINI_MODEL or settings.AI_MODEL or "gemini-flash-latest").strip(" \"'")
        if not gemini_key:
            logger.warning("AI_PROVIDER is set to 'gemini' but GEMINI_API_KEY is empty. Falling back to DemoAIProvider.")
            return DemoAIProvider(model_name=gemini_model)
        logger.info(f"Using active AI provider: gemini (model: {gemini_model})")
        return GeminiProvider(
            api_key=gemini_key,
            model_name=gemini_model,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )

    api_key = settings.AI_API_KEY.strip(" \"'")

    if provider_type == "demo" or not api_key:
        return DemoAIProvider(model_name=settings.AI_MODEL)

    if provider_type in ("openai", "groq", "openai_compatible", "generic", "together", "deepseek"):
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
