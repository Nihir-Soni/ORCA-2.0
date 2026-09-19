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
        "intent must be exactly one of: fishing_safety, find_pfz, fishing_outlook, route, "
        "emergency, weather, marine_conditions, alerts, restricted, general_query, historical_analysis. "
        "activity must be fishing or travel. language must be en, hi, or kn. "
        "needs must be a JSON array of specialist names. Do not invent coordinates "
        "or locations; use an empty location_text when none is stated.\n\n"
        "CRITICAL ROUTING RULES:\n"
        "- Use historical_analysis if the query asks about TRENDS, CHANGES, or CONDITIONS OVER TIME. "
        "Signal words include: trend, trends, changed, changing, increased, decreased, rising, falling, "
        "productivity trend, marine productivity, fish productivity, ocean productivity, "
        "chlorophyll trend, chlorophyll change, SST trend, how has X changed, how have conditions, "
        "over the last N days/weeks/months, last month, last week, previously, history, historical, "
        "was productivity higher, were conditions better.\n"
        "- Use find_pfz ONLY if the user explicitly asks WHERE to fish or wants fishing zone locations. "
        "Do NOT use find_pfz for trend or productivity questions even if the word 'fish' appears.\n"
        "- Use fishing_safety ONLY for current safety/risk questions (safe to go now, risk level, weather).\n"
        "- 'fish productivity trend', 'marine productivity', 'has chlorophyll changed' -> historical_analysis, NOT find_pfz.\n\n"
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
        "based strictly on the following data context. "
        "For every real-time measurement or safety warning, cite the data source in brackets "
        "at the end of the sentence, for example: 'The wave height is 2.5m [Source: INCOIS]'.\n\n"
    )
    
    if context_data.get("historical"):
        prompt += (
            "HISTORICAL DATA RULES — STRICTLY ENFORCE ALL:\n"
            "- Use ONLY the supplied historical evidence. Do not invent values, dates, or provider results.\n"
            "- Do not perform unsupported numerical calculations or extrapolations.\n"
            "- Do not claim causation from correlation (e.g. do not say high CHL = more fish).\n"
            "- Clearly state when a variable is unavailable.\n"
            "- Use exact provider provenance when citing sources.\n"
            "- Distinguish observation from interpretation.\n"
            "- CHL is an indicator of phytoplankton/biological productivity potential. "
            "Do NOT equate it with fish abundance or catch.\n"
            "- Prefer precise language: 'higher chlorophyll indicates greater phytoplankton biomass', "
            "not 'there are more fish here'.\n\n"
        )
    
    prompt += (
        "STRICT GROUNDING RULES — APPLY TO EVERY RESPONSE:\n"
        "1. Do NOT invent regional scientific knowledge not present in the evidence. "
        "If the user asks which REGION has high CHL or SST, answer only if the evidence "
        "contains spatial observations for multiple regions. If it does not, say: "
        "'ORCA currently has observations for your selected location but does not have "
        "enough spatially comparable observations to rank regions across the coast.'\n"
        "2. Do NOT use words like 'usually', 'typically', 'known for', 'likely has', "
        "'productive fishing grounds' unless the supplied evidence explicitly supports that claim.\n"
        "3. Do NOT draw on LLM training knowledge about upwelling zones, coastal geography, "
        "or typical fish habitats unless the question is purely educational and the evidence "
        "context does not contain real-time or historical data that contradicts it.\n"
        "4. If the evidence is insufficient to answer the question, say so clearly rather "
        "than filling the gap with general knowledge.\n"
        "5. Write in plain text only. No Markdown. Keep it conversational, short, "
        "and easy to read aloud. Write exactly 1 or 2 short paragraphs.\n"
        "6. ONLY answer the user's specific question (found in Context Data -> intent -> raw_query). "
        "Do NOT summarize extra risk or weather data unless it is directly relevant "
        "or there is an extreme, imminent danger.\n\n"
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