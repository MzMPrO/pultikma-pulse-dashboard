"""Minimal OpenAI-compatible chat-completions client. Provider is chosen purely by env:
LLM_BASE_URL, LLM_API_KEY, LLM_MODEL. Nothing provider-specific is hardcoded."""
from __future__ import annotations

import httpx

from ..core import config


def is_configured() -> bool:
    return config.llm_settings() is not None


def complete(messages: list[dict], tools: list[dict] | None = None, timeout: float = 25.0) -> dict:
    """POST {base}/chat/completions and return choices[0].message. Raises on any failure."""
    settings = config.llm_settings()
    if settings is None:
        raise RuntimeError("LLM is not configured")
    base, key, model = settings
    payload: dict = {"model": model, "messages": messages, "temperature": 0.3}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    r = httpx.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json=payload,
        timeout=timeout,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]
