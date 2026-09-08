"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle, AlertTriangle, RefreshCw, Clock, Zap, ShieldAlert } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || "Flashresume@123";

interface RecoveryRow {
  id: string;
  order_id: string;
  plan_type: string;
  error_msg: string;
  created_at: string;
}

interface RecoveryStatus {
  unresolved: number;
  recent: RecoveryRow[];
}

interface PendingPayments {
  count: number;
  stuck_over_15m?: number;
}

export default function PaymentHealthPanel() {
  const [recovery, setRecovery] = useState<RecoveryStatus | null>(null);
  const [pending, setPending] = useState<PendingPayments | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<"reconcile" | "recover" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const [recRes, pendRes] = await Promise.all([
        fetch(`${API_URL}/api/payments/recovery-queue-status`, {
          headers: { "X-Admin-Key": ADMIN_KEY },
        }),
        fetch(`${API_URL}/api/payments/pending-count`, {
          headers: { "X-Admin-Key": ADMIN_KEY },
        }).catch(() => null),
      ]);

      if (recRes.ok) {
        const data = await recRes.json();
        setRecovery(data);
      }

      if (pendRes && pendRes.ok) {
        const data = await pendRes.json();
        setPending(data);
      }
    } catch (e) {
      console.error("PaymentHealth fetch failed", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const triggerReconcile = async () => {
    setTriggering("reconcile");
    setLastResult(null);
    try {
      const res = await fetch(`${API_URL}/api/payments/reconcile`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setLastResult(
          `✓ Reconcile done: ${data.processed ?? 0} pending payments fixed, ${data.remaining ?? 0} remaining`
        );
      } else {
        setLastResult(`⚠ Reconcile: ${data.detail || data.error || data.message || "Unknown issue"}`);
      }
    } catch (e: any) {
      setLastResult(`✗ Error: ${e.message}`);
    } finally {
      setTriggering(null);
      fetchHealth();
    }
  };

  const triggerRecover = async () => {
    setTriggering("recover");
    setLastResult(null);
    try {
      const res = await fetch(`${API_URL}/api/payments/recover-queue`, {
        method: "POST",
        headers: { "X-Admin-Key": ADMIN_KEY },
      });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        setLastResult(
          `✓ Recovery done: ${data.fixed ?? 0} users fixed, ${data.skipped ?? 0} skipped`
        );
      } else {
        setLastResult(`⚠ Recovery: ${data.detail || data.error || "Unknown issue"}`);
      }
    } catch (e: any) {
      setLastResult(`✗ Error: ${e.message}`);
    } finally {
      setTriggering(null);
      fetchHealth();
    }
  };

  const unresolvedCount = recovery?.unresolved ?? 0;
  const pendingCount = pending?.count ?? 0;
  const stuckCount = pending?.stuck_over_15m ?? 0;
  const isHealthy = unresolvedCount === 0 && stuckCount === 0;

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30]">Payment Health</h2>
          <p className="text-sm text-[#595c5d]">Cron-driven reconciliation &amp; credit recovery</p>
        </div>
        <div className="flex items-center gap-2">
          {isHealthy ? (
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
              <CheckCircle className="w-3 h-3" /> Healthy
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
              <AlertTriangle className="w-3 h-3" /> Issues Detected
            </span>
          )}
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="p-2 rounded-lg text-[#006859] hover:bg-[#006859]/10 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Recovery queue card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className={`rounded-2xl p-5 border ${
            unresolvedCount > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50 border-emerald-200"
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#595c5d] mb-1">
            Recovery Queue
          </div>
          <div
            className={`text-3xl font-black font-headline ${
              unresolvedCount > 0 ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {loading ? "-" : unresolvedCount}
          </div>
          <div className="text-xs text-[#595c5d] mt-1">
            {unresolvedCount === 0
              ? "All credits granted ✓"
              : "Paid but credits not granted"}
          </div>
        </motion.div>

        {/* Pending payments card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl p-5 border bg-white border-[#eff1f2]"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#595c5d] mb-1">
            Pending Orders
          </div>
          <div className="text-3xl font-black font-headline text-[#2c2f30]">
            {loading ? "-" : pendingCount}
          </div>
          <div className="text-xs text-[#595c5d] mt-1">
            {stuckCount > 0 ? (
              <span className="text-amber-600 font-semibold">{stuckCount} stuck &gt; 15m</span>
            ) : (
              "Normal checkout sessions"
            )}
          </div>
        </motion.div>

        {/* Auto-crons info card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl p-5 border bg-[#f8fffe] border-[#006859]/15"
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#595c5d] mb-2">
            Auto Worker Active
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-[#006859]" />
              <span className="font-semibold text-[#2c2f30]">Every 10 min</span>
              <span className="text-[#595c5d]">• Auto-reconcile &amp; recover</span>
            </div>
            <div className="text-[11px] text-[#006859] font-medium">
              Runs 24/7 on Render backend
            </div>
          </div>
        </motion.div>
      </div>

      {/* Manual trigger buttons */}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          onClick={triggerReconcile}
          disabled={!!triggering}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#006859] text-white hover:bg-[#005548] disabled:opacity-60 transition-colors shadow-sm"
        >
          {triggering === "reconcile" ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Run Reconcile Now
        </button>
        <button
          onClick={triggerRecover}
          disabled={!!triggering}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60 transition-colors shadow-sm"
        >
          {triggering === "recover" ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldAlert className="w-4 h-4" />
          )}
          Fix Recovery Queue
        </button>
      </div>

      {/* Last execution result */}
      {lastResult && (
        <div className="text-sm font-medium text-[#2c2f30] bg-[#f5f6f7] rounded-xl px-4 py-3 border border-[#eff1f2]">
          {lastResult}
        </div>
      )}

      {/* Unresolved rows table */}
      {unresolvedCount > 0 && recovery?.recent && recovery.recent.length > 0 && (
        <div className="pt-2 border-t border-[#eff1f2]">
          <h3 className="text-sm font-bold text-[#2c2f30] mb-3">Unresolved Rows (most recent first)</h3>
          <div className="space-y-2">
            {recovery.recent.map((row) => (
              <div
                key={row.id}
                className="flex items-start justify-between text-xs bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
              >
                <div>
                  <div className="font-bold text-[#2c2f30]">{row.order_id}</div>
                  <div className="text-[#595c5d] mt-0.5">
                    Plan: <span className="font-semibold">{row.plan_type}</span>
                    {" • "}
                    {new Date(row.created_at).toLocaleString("en-IN", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  {row.error_msg && (
                    <div className="text-amber-700 mt-1 font-mono text-[10px] max-w-md break-all">
                      {row.error_msg}
                    </div>
                  )}
                </div>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
