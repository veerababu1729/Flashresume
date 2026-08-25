import os
import uuid
import asyncio
import random
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from models.request_models import GenerateRequest
import supabase_client as sc
from rate_limiter import limiter
from services.queue_manager import queue_manager, generate_idempotency_key

router = APIRouter()

_MAX_RESUME_CHARS = 15_000
_MAX_JD_CHARS     = 8_000

@router.post("/generate")
@limiter.limit("10/minute")
async def generate_resume_endpoint(request: Request, payload: GenerateRequest, authorization: str = Header(None)):
    if len(payload.resume_text) > _MAX_RESUME_CHARS:
        raise HTTPException(status_code=400, detail=f"Resume text is too large.")
    if payload.job_description and len(payload.job_description) > _MAX_JD_CHARS:
        raise HTTPException(status_code=400, detail=f"Job description is too large.")

    user_id: str | None = None
    if authorization and authorization.startswith("Bearer ") and sc.supabase:
        token = authorization.split(" ", 1)[1]
        try:
            user_resp = await asyncio.to_thread(lambda: sc.supabase.auth.get_user(token))
            user_id = user_resp.user.id if user_resp and user_resp.user else None
        except Exception:
            pass

    if user_id and sc.supabase:
        try:
            u_res = await asyncio.to_thread(
                lambda: sc.supabase.table("users").select("fraud_tracker_counter, credits_balance").eq("id", user_id).single().execute()
            )
            if u_res and u_res.data:
                if (u_res.data.get("fraud_tracker_counter", 0) or 0) >= 5 and (u_res.data.get("credits_balance", 0) or 0) <= 0:
                    raise HTTPException(status_code=403, detail="LIMIT_REACHED: Please upgrade to continue.")
        except HTTPException:
            raise
        except Exception:
            pass

    idemp_key = generate_idempotency_key(user_id, payload.resume_text)
    
    # Store payload + auth info for the worker
    worker_payload = {
        "payload": payload.model_dump(),
        "user_id": user_id
    }
    
    # Drop into FIFO Bucket
    job_id = await queue_manager.enqueue_job(worker_payload, idemp_hash=idemp_key)
    
    # O(1) Handoff - return 202 Accepted
    return JSONResponse(status_code=202, content={"job_id": job_id, "status": "pending"})

@router.get("/jobs/{job_id}/status")
async def get_job_status(job_id: str):
    job = await queue_manager.get_job_status(job_id)
    if not job:
        # Check DLQ
        if job_id in queue_manager.dlq:
            return JSONResponse(content={"status": "failed", "error": queue_manager.dlq[job_id].get("error", "Unknown error")})
        raise HTTPException(status_code=404, detail="Job not found")
        
    return JSONResponse(content={
        "status": job["status"],
        "result": job.get("result"),
        "error": job.get("error")
    })
