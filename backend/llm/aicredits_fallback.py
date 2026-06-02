import os
import re
import time
from dotenv import load_dotenv

load_dotenv()

# -------------------------------------------------------------------
# AICredits API Client
# Single client for both R1 and R2 using the same account key.
# URL: https://api.aicredits.in/v1
# -------------------------------------------------------------------
_BASE_URL = "https://api.aicredits.in/v1"

_client = None

def _get_client():
    global _client
    if _client is None:
        from openai import AsyncOpenAI
        api_key = os.getenv("AICREDITS_API_KEY")
        if not api_key:
            return None
        # We use a generous timeout because generations can take time
        _client = AsyncOpenAI(base_url=_BASE_URL, api_key=api_key, timeout=90)
    return _client

def _extract_text(response) -> str | None:
    """Safely pull text from the OpenAI-compatible response and strip <think> tags."""
    try:
        text = response.choices[0].message.content
        if text is None:
            return None
        text = text.strip()
        if not text:
            return None
        
        # Remove reasoning block if present
        text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
        if not text:
            return None
            
        # Clean markdown code blocks (important for JSON)
        if text.startswith("```"):
            parts = text.split("```")
            text = parts[1] if len(parts) > 1 else text
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()
            
        # If it's supposed to be JSON, aggressively extract the JSON object
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            text = match.group(0)
            
        if len(text.strip()) < 5:
            return None
            
        return text
    except (AttributeError, IndexError, TypeError):
        return None

async def _call_aicredits_single(get_client_fn, model: str, prompt: str, max_tokens: int, retries: int = 1) -> dict:
    client = get_client_fn()
    if client is None:
        return {
            "success": False, "text": None, "model": None, "speed": None,
            "attempts": [{"model": model, "status": "skipped — AICredits API key not configured"}],
        }

    attempts = []
    for attempt in range(retries + 1):
        try:
            start = time.time()
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=max_tokens,
            )
            elapsed = round(time.time() - start, 2)
            text = _extract_text(response)

            if text is None:
                attempts.append({"model": model, "status": "empty_or_null_response"})
                break

            return {
                "success": True, "text": text, "model": model,
                "speed": elapsed, "attempts": attempts + [{"model": model, "status": "pass"}],
            }
        except Exception as e:
            err = str(e)
            attempts.append({"model": model, "status": err[:80]})
            
            # Fast fail conditions
            if any(x in err for x in ["429", "rate_limit", "rate limit", "too many requests", "RESOURCE_EXHAUSTED"]):
                break
            if any(x in err for x in ["404", "model_not_found", "does not exist", "No such model"]):
                break
            if any(x in err for x in ["401", "403", "invalid_api_key", "Unauthorized", "authentication"]):
                break
            if "context_length_exceeded" in err or "maximum context" in err.lower():
                break

            # Retry conditions
            if any(x in err for x in ["503", "500", "502", "overloaded", "capacity"]):
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            if "timeout" in err.lower() or "timed out" in err.lower():
                if attempt < retries:
                    import asyncio
                    await asyncio.sleep(1)
                continue
            break

    return {"success": False, "text": None, "model": None, "speed": None, "attempts": attempts}

async def call_single_aicredits_r1(model: str, prompt: str, max_tokens: int = 2500) -> dict:
    """Call an AICredits model for R1 (Analysis)."""
    return await _call_aicredits_single(_get_client, model, prompt, max_tokens)

async def call_single_aicredits_r2(model: str, prompt: str, max_tokens: int = 4000) -> dict:
    """Call an AICredits model for R2 (Generation)."""
    return await _call_aicredits_single(_get_client, model, prompt, max_tokens)
