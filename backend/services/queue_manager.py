import os
import uuid
import json
import asyncio
import time
from datetime import datetime, timezone
import hashlib
import redis.asyncio as redis

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class RedisQueueManager:
    def __init__(self):
        self.redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        self.MAIN_QUEUE = "flashresume:queue:pending"
        self.PROCESSING_QUEUE = "flashresume:queue:processing"
        self.DLQ = "flashresume:queue:dlq"
        self.JOB_HASH = "flashresume:jobs"
        self.IDEMP_HASH = "flashresume:idempotency"
        # Token Bucket configs
        self.TOKEN_BUCKET_KEY = "flashresume:llm:tokens"
        self.MAX_RPM = 15 # e.g. 15 requests per minute

    async def enqueue_job(self, payload: dict, idemp_hash: str = None) -> str:
        if idemp_hash:
            existing_job_id = await self.redis_client.hget(self.IDEMP_HASH, idemp_hash)
            if existing_job_id:
                job_data_raw = await self.redis_client.hget(self.JOB_HASH, existing_job_id)
                if job_data_raw:
                    job_data = json.loads(job_data_raw)
                    if job_data.get("status") in ["pending", "processing"]:
                        return existing_job_id

        job_id = str(uuid.uuid4())
        job_data = {
            "status": "pending",
            "payload": payload,
            "result": None,
            "retries": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_active": time.time()
        }

        async with self.redis_client.pipeline(transaction=True) as pipe:
            if idemp_hash:
                pipe.hset(self.IDEMP_HASH, idemp_hash, job_id)
                pipe.expire(self.IDEMP_HASH, 3600)
            pipe.hset(self.JOB_HASH, job_id, json.dumps(job_data))
            pipe.lpush(self.MAIN_QUEUE, job_id)
            await pipe.execute()

        return job_id

    async def dequeue_job(self, timeout: int = 0) -> str | None:
        job_id = await self.redis_client.brpoplpush(self.MAIN_QUEUE, self.PROCESSING_QUEUE, timeout=timeout)
        if job_id:
            # Update last_active for the zombie watcher
            await self._update_last_active(job_id)
        return job_id

    async def _update_last_active(self, job_id: str):
        job_data_raw = await self.redis_client.hget(self.JOB_HASH, job_id)
        if job_data_raw:
            job_data = json.loads(job_data_raw)
            job_data["last_active"] = time.time()
            await self.redis_client.hset(self.JOB_HASH, job_id, json.dumps(job_data))

    async def set_job_status(self, job_id: str, status: str, result: dict = None, error: str = None):
        job_data_raw = await self.redis_client.hget(self.JOB_HASH, job_id)
        if job_data_raw:
            job_data = json.loads(job_data_raw)
            job_data["status"] = status
            job_data["last_active"] = time.time()
            if result: job_data["result"] = result
            if error: job_data["error"] = error
            await self.redis_client.hset(self.JOB_HASH, job_id, json.dumps(job_data))

    async def get_job_status(self, job_id: str) -> dict | None:
        job_data_raw = await self.redis_client.hget(self.JOB_HASH, job_id)
        if job_data_raw: return json.loads(job_data_raw)
        return None

    async def fail_job(self, job_id: str, error: str):
        job_data_raw = await self.redis_client.hget(self.JOB_HASH, job_id)
        if job_data_raw:
            job_data = json.loads(job_data_raw)
            job_data["retries"] += 1
            if job_data["retries"] >= 2:
                job_data["status"] = "failed"
                job_data["error"] = error
                async with self.redis_client.pipeline(transaction=True) as pipe:
                    pipe.hset(self.JOB_HASH, job_id, json.dumps(job_data))
                    pipe.lrem(self.PROCESSING_QUEUE, 1, job_id)
                    pipe.lpush(self.DLQ, job_id)
                    await pipe.execute()
            else:
                job_data["status"] = "pending"
                async with self.redis_client.pipeline(transaction=True) as pipe:
                    pipe.hset(self.JOB_HASH, job_id, json.dumps(job_data))
                    pipe.lrem(self.PROCESSING_QUEUE, 1, job_id)
                    pipe.lpush(self.MAIN_QUEUE, job_id)
                    await pipe.execute()

    async def ack_job(self, job_id: str):
        await self.redis_client.lrem(self.PROCESSING_QUEUE, 1, job_id)
        job_data_raw = await self.redis_client.hget(self.JOB_HASH, job_id)
        if job_data_raw:
             job_data = json.loads(job_data_raw)
             if "payload" in job_data: del job_data["payload"]
             await self.redis_client.hset(self.JOB_HASH, job_id, json.dumps(job_data))

    # --- NEW: Distributed Token Bucket ---
    async def wait_for_llm_capacity(self):
        """Blocks until the LLM Token Bucket has capacity."""
        while True:
            current_time = int(time.time())
            window_key = f"{self.TOKEN_BUCKET_KEY}:{current_time // 60}"
            
            async with self.redis_client.pipeline(transaction=True) as pipe:
                pipe.incr(window_key)
                pipe.expire(window_key, 120)
                results = await pipe.execute()
            
            requests_this_minute = results[0]
            if requests_this_minute <= self.MAX_RPM:
                return True
            else:
                await asyncio.sleep(2) # Throttle and wait

    # --- NEW: Zombie Watcher ---
    async def requeue_zombies(self, timeout_seconds=60):
        """Reclaims jobs from PROCESSING queue that haven't been active."""
        processing_jobs = await self.redis_client.lrange(self.PROCESSING_QUEUE, 0, -1)
        for job_id in processing_jobs:
            job_data_raw = await self.redis_client.hget(self.JOB_HASH, job_id)
            if job_data_raw:
                job_data = json.loads(job_data_raw)
                last_active = job_data.get("last_active", 0)
                if time.time() - last_active > timeout_seconds:
                    print(f"[Zombie Watcher] Re-queuing zombie job: {job_id}")
                    # Atomically move back to MAIN_QUEUE
                    async with self.redis_client.pipeline(transaction=True) as pipe:
                        pipe.lrem(self.PROCESSING_QUEUE, 1, job_id)
                        pipe.lpush(self.MAIN_QUEUE, job_id)
                        await pipe.execute()

queue_manager = RedisQueueManager()

def generate_idempotency_key(user_id: str, resume_text: str) -> str:
    raw = f"{user_id or 'anon'}_{hashlib.sha256(resume_text.encode()).hexdigest()}"
    return hashlib.sha256(raw.encode()).hexdigest()
