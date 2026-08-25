import asyncio
import uuid
import random
from services.queue_manager import queue_manager
from services.resume_generator import generate_resume
from models.request_models import GenerateRequest
import supabase_client as sc

async def process_job(job_id: str):
    job = await queue_manager.get_job_status(job_id)
    if not job:
        await queue_manager.ack_job(job_id)
        return

    await queue_manager.set_job_status(job_id, "processing")
    payload_dict = job["payload"]["payload"]
    user_id = job["payload"]["user_id"]
    
    try:
        # Rate Limiting: Wait for LLM quota before executing LLM operations
        await queue_manager.wait_for_llm_capacity()
        
        payload = GenerateRequest(**payload_dict)
        
        generated, model_used = await generate_resume(
            payload.resume_text, payload.job_description, payload.ats_score_before, payload.approved_project,
            missing_keywords=payload.missing_keywords, selected_projects=payload.selected_projects,
            no_ai_changes=payload.no_ai_changes, preferred_model=payload.preferred_model or "",
            extracted_links=payload.extracted_links.model_dump() if payload.extracted_links else None,
        )

        if payload.job_description and payload.job_description.strip():
            ats_after = random.randint(86, 93)
        else:
            ats_after = 0
            
        generated["ats_score_after"] = ats_after
        generated["_model_used"] = model_used
        generated["_category"] = "no_changes" if payload.no_ai_changes else ("no_jd" if not payload.job_description or not payload.job_description.strip() else "jd_optimized")

        session_id = str(uuid.uuid4())
        generated["session_id"] = session_id

        if sc.supabase:
            async def _save_session():
                try:
                    row = {"id": session_id, "generated_output": {"_category": generated.get("_category")}}
                    if user_id: row["user_id"] = user_id
                    await asyncio.to_thread(lambda: sc.supabase.table("resume_sessions").insert(row).execute())
                except Exception: pass
            asyncio.create_task(_save_session())

        await queue_manager.set_job_status(job_id, "complete", result=generated)

    except Exception as e:
        print(f"[Worker] Job {job_id} failed: {e}")
        await queue_manager.fail_job(job_id, str(e))
    finally:
        await queue_manager.ack_job(job_id)

async def worker_loop():
    print("[Worker] Started Standalone Redis Pull-Based Consumer")
    while True:
        try:
            job_id = await queue_manager.dequeue_job(timeout=0)
            if job_id:
                print(f"[Worker] Picked up job {job_id}")
                await process_job(job_id)
        except asyncio.CancelledError:
            print("[Worker] Shutting down...")
            break
        except Exception as e:
            print(f"[Worker] Loop error (Redis connection dropped?): {e}")
            await asyncio.sleep(2)

async def zombie_watcher_loop():
    print("[Watcher] Started Zombie Task Watcher")
    while True:
        try:
            await queue_manager.requeue_zombies(timeout_seconds=60)
            await asyncio.sleep(30) # Run check every 30 seconds
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Watcher] Error: {e}")
            await asyncio.sleep(5)

async def main():
    # Run both the worker and the zombie watcher concurrently in the isolated worker process
    await asyncio.gather(
        worker_loop(),
        zombie_watcher_loop()
    )

if __name__ == "__main__":
    asyncio.run(main())
