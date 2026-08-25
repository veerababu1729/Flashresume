# FlashResume Streamlined Microservices Architecture (Production Final)

This updated blueprint provides a lightweight, cost-effective, and highly secure microservices strategy for FlashResume. Designed for a solo developer needing low operational overhead, it focuses on eliminating single points of failure while actively preventing security vulnerabilities and resource exhaustion.

---

## 1. Lightweight Service Split (Modular Approach)

We consolidate the architecture into a **Two-Tier System**, drastically reducing deployment complexity, maintenance, and cloud costs.

### A. Core API & Orchestration Service (IO-Bound)
- **Role:** Handles routing, frontend integration, LLM fallback orchestration, rate-limiting, and Supabase database interactions.
- **Scaling:** Can autoscale safely because IO (network waits for LLM responses) is the bottleneck here.

### B. Heavy Compute Worker Service (CPU-Bound)
- **Role:** Dedicated environment for resource-heavy tasks: 3-layer PDF Parsing (Tesseract OCR) and LaTeX PDF Compilation (`poppler-utils`, `texlive`).
- **Scaling:** Kept strictly limited (e.g., 1-2 instances) to manage costs. This ensures a spike in LLM generations doesn't crash the heavy document compiler.

---

## 2. Complexity Optimization (Time & Space Bounds)

Applying strict asymptotic bounds ensures the Two-Tier system remains highly performant and stable under load.

### A. Time Complexity (Latency Optimization)
- **API Gateway & Orchestrator ($O(1)$):** Must operate at strictly $O(1)$ for request handoffs. The API immediately drops the JSON payload into the transient store, pushes the `job_id` to Redis, and returns an HTTP 202 to the frontend.
- **LLM Orchestration ($O(T)$):** Network IO-bound, where time complexity scales roughly at $O(T)$ ($T$ = generated token count). Implement aggressive `asyncio` timeouts that instantly trip the native circuit breaker to prevent cascading latency bottlenecks.
- **Compute Worker ($O(N)$):** Parsing and compiling are CPU-bound. Time scales at $O(N)$, where $N$ is document pages. Worker queues process strictly asynchronously.

### B. Space Complexity (Memory & Storage Management)
- **Transient PII Storage ($O(R)$):** Storage scales at $O(R)$, where $R$ is concurrent active requests. Enforce a strict TTL (Time-To-Live) on the Redis/Supabase transient storage (e.g., 5 minutes max) to guarantee aggressive garbage collection and prevent Out-Of-Memory (OOM) crashes.
- **Heavy Worker Memory Bounds:** Container memory limits must be explicitly set for worker instances. Enforce stream-processing for large PDF uploads rather than loading entire binary files into active RAM.
- **Database Connections ($O(C)$):** Active PostgreSQL connections scale at $O(C)$, where $C$ is active Core API instances. PgBouncer or Supavisor keeps this strictly bound to the configured pool limit.

---

## 3. Load Leveling & Worker Ingestion

### A. The FIFO "Bucket" Mechanism
- **O(1) Handoff:** During high traffic, the Core API's only job is to drop the `job_id` into the Redis bucket and immediately return a pending status.

### B. Controlled Worker Consumption
- **Pull-Based Processing:** Backend workers operate as pull-based consumers. They only pull the next `job_id` from the bucket when their current task is fully processed.
- **Guaranteed Crash Prevention:** This guarantees that even if 1,000 requests arrive simultaneously, heavy workers never exceed designated compute thresholds.

---

## 4. Operational Resilience & Edge Cases (Queue Defense)

Operating an asynchronous FIFO queue introduces distributed edge cases that must be strictly managed to maintain system flow.

### A. Poison Pill & Dead Letter Queue (DLQ) Handling
- **Problem:** A malformed PDF or corrupted payload crashes the compute worker.
- **Resolution:** Implement a retry counter (max 2 retries) with exponential backoff. If a job fails repeatedly, evict it to a Dead Letter Queue (DLQ) and return an explicit error state to the client.

### B. Request Idempotency (Duplicate Prevention)
- **Problem:** Rapid multiple clicks or network retries enqueue duplicate expensive tasks.
- **Resolution:** Generate a deterministic idempotency key (hash of `user_session_id` + `file_hash`). Perform an $O(1)$ lookup against Redis before queuing to reject duplicates.

### C. Client-Worker Notification Delivery
- **Problem:** The client must receive state updates without bombarding the API.
- **Resolution:** Serve **Server-Sent Events (SSE)** from the Core API to provide lightweight, one-way status streams (e.g., `Queued` $\rightarrow$ `Parsing` $\rightarrow$ `Generating` $\rightarrow$ `Complete`).

---

## 5. Security & Data Privacy

### A. The "Claim Check" Pattern (PII Queue Protection)
- **Flow:** 
  1. Core API writes raw JSON/PII to a highly transient, encrypted, in-memory store.
  2. The FIFO queue only transmits the `job_id`.
  3. Worker receives the `job_id`, retrieves the payload securely, processes it, and purges the data. 

### B. Aggressive LaTeX Sanitization (Preventing RCE)
- **Implementation:** 
  1. Invoke the compiler with shell escape disabled (`pdflatex -no-shell-escape`). 
  2. Aggressively strip dangerous characters from LLM outputs.
  3. Run the LaTeX compiler within an unprivileged, read-only Docker container.

---

## 6. The "Bulletproof" Production Extensions (Final Edge Cases)

To ensure this architecture operates with highest capabilities across all categories without degrading existing requirements, we must address the final invisible points of failure: State Consistency, Ephemeral Storage Exhaustion, and Distributed API Quotas.

### A. Data Management: Zombie Task Recovery (ACK & Visibility Protocol)
- **The Missing Point:** If a worker successfully pulls a `job_id` via a standard pop operation but crashes (e.g., hardware failure, OOM killer) mid-processing, that task is lost forever (a "Zombie" task).
- **The Bulletproof Fix:** Implement a **Message Acknowledgement (ACK)** protocol with a **Visibility Timeout**. Instead of a destructive pop (like Redis `LPOP`), use `RPOPLPUSH` (or Redis Streams pending entries). The task is moved to a hidden "Processing" queue. If the worker does not send an explicit ACK within 60 seconds, a background watcher assumes the worker died and automatically moves the `job_id` back to the main queue for another worker to process. Guarantees *At-Least-Once* delivery without data loss.

### B. Space Complexity: Ephemeral Disk Exhaustion (O(1) Worker Storage)
- **The Missing Point:** While RAM and database limits are strictly bound, the LaTeX compilation process dumps auxiliary files (`.aux`, `.log`, `.out`, `.pdf`) onto the worker's local disk. Over time, space complexity grows at $O(J)$ (where $J$ is total jobs), leading to a "No space left on device" crash.
- **The Bulletproof Fix:** Mandate the use of an in-memory `tmpfs` volume for the `/tmp/out` compilation directory in your Docker run configurations. Alternatively, enforce an aggressive `finally:` execution block in the Python worker that runs `shutil.rmtree()` on the temporary working directory regardless of success or failure. This mathematically guarantees the worker's disk usage remains $O(1)$.

### C. Time Complexity: Distributed Token Bucket Rate Limiting (LLM Protection)
- **The Missing Point:** Your circuit breaker protects against LLM *outages*, but if 5 autoscaled workers pull 5 long resumes simultaneously, they might exceed your Gemini API's Requests-Per-Minute (RPM) or Tokens-Per-Minute (TPM) quota, triggering HTTP 429s (Too Many Requests) and forcing an unnecessary fallback to the less-capable Qwen model.
- **The Bulletproof Fix:** Integrate a centralized **Distributed Token Bucket** in Redis. Before a worker pulls a task from the queue, it must verify there is sufficient RPM/TPM capacity in the bucket. If the API quota is nearing its limit, the workers intentionally throttle their pull rate. This ensures you extract maximum value from your primary LLM (Gemini) before ever needing to rely on the fallback chain.

---

## 7. Deployment Strategy

- **Platform:** Continue using Render or migrate to lightweight container platforms like Railway or Fly.io.
- **Setup:** 
  1 Web Service (Core API / Orchestrator) $\rightarrow$ 1 Background Worker (Compute Worker) $\rightarrow$ 1 Redis Instance (Message Broker / State Store).
