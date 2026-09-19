"""Backend-only Groq adapter for structured ORCA intent extraction."""
from __future__ import annotations

import json
from typing import Any, Dict, Mapping

import httpx

from ..config import (GROQ_API_KEY, GROQ_MODEL, GROQ_TIMEOUT_SECONDS,
                      NVIDIA_API_KEY, NVIDIA_BASE_URL, NVIDIA_MODEL,
                      NVIDIA_TIMEOUT_SECONDS)


class GroqIntentError(RuntimeError):
    """A safe, user-facing category of AI intent failure."""


class ProviderPayload(dict):
    """Provider-tagged dict that keeps the existing payload contract."""

    def __init__(self, payload: Mapping[str, Any], provider: str):
        super().__init__(payload)
        self.provider = provider


def _is_retryable_provider_error(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429 or 500 <= status <= 599:
            return True
        if 400 <= status <= 499:
            message = exc.response.text.lower()
            return any(term in message for term in (
                "rate limit", "rate_limit", "quota", "token limit",
                "token exhausted", "tokens exhausted", "insufficient_quota",
            ))
        return False
    return isinstance(exc, httpx.TransportError)


def _post_completion(provider: str, payload: Dict[str, Any]) -> httpx.Response:
    if provider == "GROQ":
        url = "https://api.groq.com/openai/v1/chat/completions"
        api_key, model, timeout = GROQ_API_KEY, GROQ_MODEL, GROQ_TIMEOUT_SECONDS
    else:
        url = f"{NVIDIA_BASE_URL.rstrip('/')}/chat/completions"
        api_key, model, timeout = NVIDIA_API_KEY, NVIDIA_MODEL, NVIDIA_TIMEOUT_SECONDS

    print(f"AI provider attempt: {provider}")
    response = httpx.post(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        json={**payload, "model": model},
        timeout=timeout,
    )
    response.raise_for_status()
    return response


def _post_with_fallback(payload: Dict[str, Any]) -> tuple[httpx.Response, str]:
    try:
        response = _post_completion("GROQ", payload)
        print("AI provider used: GROQ")
        return response, "GROQ"
    except httpx.HTTPError as exc:
        status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
        print(f"AI provider GROQ failed: status={status or 'transport'}")
        if not _is_retryable_provider_error(exc) or not NVIDIA_API_KEY:
            raise
        print("AI provider fallback triggered: NVIDIA")
        try:
            response = _post_completion("NVIDIA", payload)
            print("AI provider used: NVIDIA_FALLBACK")
            return response, "NVIDIA_FALLBACK"
        except httpx.HTTPError as nvidia_exc:
            nvidia_status = (nvidia_exc.response.status_code
                             if isinstance(nvidia_exc, httpx.HTTPStatusError) else None)
            print(f"AI provider NVIDIA failed: status={nvidia_status or 'transport'}")
            raise


def extract_intent(message: str) -> Dict[str, Any]:
    print(f"DEBUG: GROQ_MODEL={GROQ_MODEL}, KEY_LEN={len(GROQ_API_KEY)}")
    if not GROQ_API_KEY:
        raise GroqIntentError("AI mode is unavailable")

    prompt = (
        "Classify this marine question for ORCA. Return JSON only with these keys: "
        "intent, activity, location_text, date, time, language, needs. "
        "intent must be one of fishing_safety, find_pfz, fishing_outlook, route, "
        "emergency, weather, marine_conditions, alerts, restricted, general_query, historical_analysis. "
        "activity must be fishing or travel. language must be en, hi, or kn. "
        "needs must be a JSON array of specialist names. Do not invent coordinates "
        "or locations; use an empty location_text when none is stated. "
        f"Question: {message}"
    )
    try:
        response, provider = _post_with_fallback({
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": "You output only valid JSON."},
                {"role": "user", "content": prompt},
            ],
        })
        content = response.json()["choices"][0]["message"]["content"]
        payload = json.loads(content)
        if not isinstance(payload, dict):
            raise ValueError("structured response was not an object")
        return ProviderPayload(payload, provider)
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        print(f"GROQ ERROR: {exc!r}")
        if isinstance(exc, httpx.HTTPStatusError):
            print(exc.response.text)
        raise GroqIntentError("AI mode is unavailable") from exc

def generate_explanation(context_data: Dict[str, Any], language: str) -> str:
    if not GROQ_API_KEY:
        return ""
        
    prompt = (
        f"You are ORCA, a marine safety assistant. Answer the user naturally in language '{language}' "
        "based strictly on the following data context for real-time measurements (waves, weather, risk). "
        "However, you MAY use your own general knowledge to answer questions about local fish species, geography, or fishing techniques. "
        "For every real-time measurement or safety warning, you MUST cite the data source in brackets "
        "at the end of the sentence, for example: 'The wave height is 2.5m [Source: INCOIS]'.\n\n"
    )
    
    if context_data.get("historical"):
        prompt += (
            "HISTORICAL DATA RULES:\n"
            "- Use only supplied historical evidence.\n"
            "- Do not invent values.\n"
            "- Do not invent dates.\n"
            "- Do not invent provider results.\n"
            "- Do not perform unsupported numerical calculations.\n"
            "- Do not claim causation from correlation.\n"
            "- Clearly identify unavailable variables.\n"
            "- Use exact provider provenance when discussing sources.\n"
            "- Distinguish observation from interpretation.\n\n"
        )
    
    prompt += (
        "IMPORTANT RULES FOR YOUR OUTPUT:\n"
        "1. Write in plain text only. Do NOT use any Markdown formatting (no asterisks **, no bullet points -, no tables).\n"
        "2. Keep it conversational, short, and easy to read aloud.\n"
        "3. Write exactly 1 or 2 short paragraphs.\n"
        "4. ONLY answer the user's specific question (found in Context Data -> intent -> raw_query). DO NOT summarize extra risk or weather data unless it is directly relevant to their question or there is an extreme, imminent danger they must know about.\n\n"
        f"Context Data:\n{json.dumps(context_data, indent=2, default=str)}"
    )
    
    try:
        response, provider = _post_with_fallback({
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": "You are a marine safety assistant. Always cite sources in brackets."},
                {"role": "user", "content": prompt},
            ],
        })
        content = response.json()["choices"][0]["message"]["content"]
        print(f"AI provider used: {provider}")
        return content.strip()
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        print(f"GROQ EXPLANATION ERROR: {exc!r}")
        return ""