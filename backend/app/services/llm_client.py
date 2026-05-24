import json
import logging
import urllib.request
import urllib.error
from flask import current_app

logger = logging.getLogger(__name__)


def _get_config(key: str, default=None):
    """Get config from Flask app context or fall back to env."""
    try:
        return current_app.config.get(key, default)
    except RuntimeError:
        import os
        from dotenv import load_dotenv
        load_dotenv()
        return os.environ.get(key, default)


def _call_ollama(
    messages: list[dict],
    model: str,
    api_key: str,
    api_url: str,
    timeout: int = 60,
) -> str | None:
    """Call Ollama Cloud chat completions API. Returns response text or None."""
    payload = json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "temperature": 0.2,
        "max_tokens": 2048,
    }).encode("utf-8")

    req = urllib.request.Request(
        api_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return body["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        logger.error("Ollama API HTTP %s: %s", e.code, e.read().decode())
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        logger.error("Ollama API response parse error: %s", e)
    except urllib.error.URLError as e:
        logger.error("Ollama API connection error: %s", e.reason)

    return None


def generate(prompt: str, system_prompt: str | None = None) -> str | None:
    """Generate text from the primary model, falling back on failure.

    Returns the response text, or None if both models fail.
    """
    api_key = _get_config("OLLAMA_API_KEY", "")
    if not api_key:
        logger.error("OLLAMA_API_KEY is not set")
        return None

    api_url = _get_config("OLLAMA_API_URL", "https://api.ollama.cloud/v1/chat/completions")
    primary = _get_config("PRIMARY_MODEL", "minimax")
    fallback = _get_config("FALLBACK_MODEL", "qwen3-coder:480b")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    # Try primary model
    logger.info("Calling Ollama with model=%s", primary)
    result = _call_ollama(messages, primary, api_key, api_url)
    if result is not None:
        return result

    # Fallback
    logger.warning("Primary model %s failed, falling back to %s", primary, fallback)
    result = _call_ollama(messages, fallback, api_key, api_url)
    return result
