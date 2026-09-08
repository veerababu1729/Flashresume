import { NextResponse } from "next/server";

/**
 * Vercel Cron Job - Payment Recovery Queue Processor
 *
 * Processes unresolved rows in payment_recovery_queue.
 * Schedule: every 15 minutes (see vercel.json).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://127.0.0.1:8000";

  const cronSecret = process.env.CRON_SECRET || "";
  const targetUrl = `${backendUrl}/api/payments/recover-queue`;

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(50000),
    });

    const data = await res.json();
    console.log(`[CronJob:recover-payments] Response: ${JSON.stringify(data)}`);

    if (!res.ok || data.status !== "ok") {
      console.error(`[CronJob:recover-payments] Backend error:`, data);
      return NextResponse.json(
        { success: false, error: "Backend recover-queue failed", detail: data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      fixed: data.fixed,
      skipped: data.skipped,
      total_fetched: data.total_fetched,
      errors: data.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[CronJob:recover-payments] Failed to reach backend:`, message);
    return NextResponse.json(
      { success: false, error: "Failed to reach backend", detail: message },
      { status: 500 }
    );
  }
}
