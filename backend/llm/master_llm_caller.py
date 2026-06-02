import asyncio
import time
import itertools
from supabase_client import supabase
from .mistral_fallback    import call_single_mistral_r1,    call_single_mistral_r2
from .groq_fallback       import call_single_groq_r1,       call_single_groq_r2
from .nvidia_fallback     import call_single_nvidia_r1,     call_single_nvidia_r2
from .aicredits_fallback  import call_single_aicredits_r1,  call_single_aicredits_r2

# ── Concurrency guard ────────────────────────────────────────────────────────
# Limits simultaneous LLM operations to 8 per worker process.
_LLM_SEMAPHORE = asyncio.Semaphore(5)
# ─────────────────────────────────────────────────────────────────────────────

_R1_MAX_TOKENS = 2500
_R2_MAX_TOKENS = 4500

# ── Per-Model Circuit Breaker State ───────────────────────────────
_COOLDOWN_SECS_429 = 120
_COOLDOWN_SECS_402 = 86400  # 24 hours for quota exhaustion
_circuit_tripped = {}  # model_id -> (timestamp, cooldown_secs)

def _is_tripped(model_id: str) -> bool:
    """Return True if model is in cooldown window."""
    tripped_info = _circuit_tripped.get(model_id)
    if tripped_info is None:
        return False
    tripped_at, cooldown = tripped_info
    if time.time() - tripped_at < cooldown:
        return True
    del _circuit_tripped[model_id]
    return False

def _trip_circuit(model_id: str, error_type: str):
    """Mark a model as rate-limited."""
    cooldown = _COOLDOWN_SECS_402 if error_type == "quota" else _COOLDOWN_SECS_429
    _circuit_tripped[model_id] = (time.time(), cooldown)

# ── WATERFALL CHAINS (Primary -> Fallbacks) ──────────────────────────────────
_R1_CHAIN = [
    ("aicredits",  "deepseek/deepseek-v4-flash",                  call_single_aicredits_r1),
    ("mistral",    "mistral-large-latest",                        call_single_mistral_r1),
    ("groq",       "llama-3.3-70b-versatile",                     call_single_groq_r1),
    ("nvidia",     "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r1),
    ("nvidia",     "mistralai/mistral-nemotron",                  call_single_nvidia_r1),
    ("mistral",    "mistral-medium-latest",                       call_single_mistral_r1),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",       call_single_nvidia_r1),
    ("mistral",    "ministral-8b-latest",                         call_single_mistral_r1),
    ("nvidia",     "mistralai/mixtral-8x22b-instruct-v0.1",       call_single_nvidia_r1),
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct",   call_single_groq_r1),
    ("mistral",    "mistral-small-latest",                        call_single_mistral_r1),
    ("nvidia",     "mistralai/mistral-small-4-119b-2603",         call_single_nvidia_r1),
    ("mistral",    "mistral-tiny-latest",                         call_single_mistral_r1),
    ("mistral",    "open-mistral-nemo",                           call_single_mistral_r1),
]

_R2_CHAIN = [
    ("aicredits",  "deepseek/deepseek-v4-flash",                  call_single_aicredits_r2),
    ("mistral",    "mistral-large-latest",                        call_single_mistral_r2),
    ("groq",       "llama-3.3-70b-versatile",                     call_single_groq_r2),
    ("nvidia",     "mistralai/mistral-medium-3.5-128b",           call_single_nvidia_r2),
    ("nvidia",     "mistralai/mistral-nemotron",                  call_single_nvidia_r2),
    ("mistral",    "mistral-medium-latest",                       call_single_mistral_r2),
    ("nvidia",     "mistralai/ministral-14b-instruct-2512",       call_single_nvidia_r2),
    ("mistral",    "ministral-8b-latest",                         call_single_mistral_r2),
    ("nvidia",     "mistralai/mixtral-8x22b-instruct-v0.1",       call_single_nvidia_r2),
    ("groq",       "meta-llama/llama-4-scout-17b-16e-instruct",   call_single_groq_r2),
    ("mistral",    "mistral-small-latest",                        call_single_mistral_r2),
    ("nvidia",     "mistralai/mistral-small-4-119b-2603",         call_single_nvidia_r2),
    ("mistral",    "mistral-tiny-latest",                         call_single_mistral_r2),
    ("mistral",    "open-mistral-nemo",                           call_single_mistral_r2),
]

_RATE_LIMIT_SIGNALS = ("429", "rate_limit", "rate limit", "too many requests", "RESOURCE_EXHAUSTED", "rate limited")
_QUOTA_SIGNALS = ("402", "quota", "payment required", "payment_required")

def _get_rate_limit_type(attempts: list) -> str | None:
    if not attempts: return None
    last_status = str(attempts[-1].get("status", "")).lower()
    if any(sig in last_status for sig in _QUOTA_SIGNALS): return "quota"
    if any(sig in last_status for sig in _RATE_LIMIT_SIGNALS): return "rate_limit"
    return None

async def _log_to_supabase(request_type: str, result: dict):
    if supabase and result.get("provider"):
        try:
            await asyncio.to_thread(
                lambda: supabase.table("llm_usage").insert({
                    "request_type": request_type,
                    "provider": result["provider"],
                    "model": result["model"],
                    "success": result["success"],
                    "speed_secs": result["speed"]
                }).execute()
            )
        except Exception:
            pass

async def call_llm_balanced(prompt: str, is_r1: bool, preferred_model: str = "") -> dict:
    chain = _R1_CHAIN if is_r1 else _R2_CHAIN
    max_tokens = _R1_MAX_TOKENS if is_r1 else _R2_MAX_TOKENS
    req_type = "r1" if is_r1 else "r2"
    
    async with _LLM_SEMAPHORE:
        all_attempts = []
        
        # 1. If user explicitly requested a model, try that exact model FIRST
        if preferred_model:
            for provider, model_id, caller in chain:
                if model_id == preferred_model:
                    if not _is_tripped(model_id):
                        result = await caller(model_id, prompt, max_tokens)
                        all_attempts.extend(result.get("attempts", []))
                        if result["success"]:
                            res_dict = {
                                "success": True, "text": result["text"], "model": result["model"],
                                "provider": provider, "speed": result["speed"], "all_attempts": all_attempts,
                            }
                            asyncio.create_task(_log_to_supabase(req_type, res_dict))
                            return res_dict
                        
                        err_type = _get_rate_limit_type(result.get("attempts", []))
                        if err_type:
                            _trip_circuit(model_id, err_type)
                    break # if preferred failed, fall down to regular waterfall

        # 2. Strict Waterfall Chain (starts at DeepSeek, falls back in order)
        for provider, model_id, caller in chain:
            # Skip if we already tried it as the preferred model and it failed
            if preferred_model and model_id == preferred_model:
                continue
                
            if _is_tripped(model_id):
                all_attempts.append({"model": model_id, "status": "circuit-tripped — cooldown active"})
                continue

            result = await caller(model_id, prompt, max_tokens)
            all_attempts.extend(result.get("attempts", []))

            if result["success"]:
                res_dict = {
                    "success": True, "text": result["text"], "model": result["model"],
                    "provider": provider, "speed": result["speed"], "all_attempts": all_attempts,
                }
                asyncio.create_task(_log_to_supabase(req_type, res_dict))
                return res_dict

            err_type = _get_rate_limit_type(result.get("attempts", []))
            if err_type:
                _trip_circuit(model_id, err_type)

    # All failed
    res_dict = {
        "success": False, "text": None, "model": None, "provider": None, "speed": None, "all_attempts": all_attempts,
    }
    asyncio.create_task(_log_to_supabase(req_type, res_dict))
    return res_dict

async def call_llm_r1(prompt: str, preferred_model: str = "") -> dict:
    return await call_llm_balanced(prompt, True, preferred_model)

async def call_llm_r2(prompt: str, preferred_model: str = "") -> dict:
    return await call_llm_balanced(prompt, False, preferred_model)
