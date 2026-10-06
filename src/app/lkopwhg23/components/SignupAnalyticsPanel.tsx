"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, TrendingUp, Calendar, BarChart2, Activity, Percent } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || "Flashresume@123";

const TIME_FILTERS = [
  { id: "today", label: "Day" },
  { id: "week",  label: "Week" },
  { id: "month", label: "Month" },
  { id: "all",   label: "All Time" },
  { id: "custom", label: "Custom" },
];

const CHART_TYPES = [
  { id: "bar",  label: "Bar",  icon: BarChart2 },
  { id: "line", label: "Line", icon: Activity },
];

interface TrendPoint {
  label: string;
  signups: number;
  paid: number;
}

interface SignupData {
  total_signups: number;
  total_paid: number;
  conversion_rate: number;
  delayed_converters: number;
  trend: TrendPoint[];
}

/* ── tiny SVG helpers ─────────────────────────────────────── */
function PolylineChart({
  data,
  seriesA,
  seriesB,
  colorA,
  colorB,
  isArea,
}: {
  data: TrendPoint[];
  seriesA: keyof TrendPoint;
  seriesB: keyof TrendPoint;
  colorA: string;
  colorB: string;
  isArea?: boolean;
}) {
  const W = 1000;
  const H = 220;
  const PAD = 32;

  const valA = data.map((d) => d[seriesA] as number);
  const valB = data.map((d) => d[seriesB] as number);
  const maxVal = Math.max(...valA, ...valB, 1);
  const step = (W - PAD * 2) / Math.max(data.length - 1, 1);

  const pts = (vals: number[]) =>
    vals.map((v, i) => [PAD + i * step, H - PAD - ((v / maxVal) * (H - PAD * 2))]);

  const toPath = (coords: number[][]) =>
    coords.map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ");

  const toArea = (coords: number[][]) =>
    toPath(coords) +
    ` L${coords[coords.length - 1][0].toFixed(1)},${(H - PAD).toFixed(1)} L${coords[0][0].toFixed(1)},${(H - PAD).toFixed(1)} Z`;

  const ptsA = pts(valA);
  const ptsB = pts(valB);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorA} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorA} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorB} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colorB} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={PAD} y1={H - PAD - f * (H - PAD * 2)}
          x2={W - PAD} y2={H - PAD - f * (H - PAD * 2)}
          stroke="#e8eaeb" strokeWidth="1"
        />
      ))}
      {isArea && (
        <>
          <path d={toArea(ptsA)} fill="url(#gradA)" />
          <path d={toArea(ptsB)} fill="url(#gradB)" />
        </>
      )}
      <path d={toPath(ptsA)} fill="none" stroke={colorA} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={toPath(ptsB)} fill="none" stroke={colorB} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />
      {/* dots */}
      {ptsA.map(([x, y], i) => (
        <circle key={`a${i}`} cx={x} cy={y} r="3" fill={colorA} />
      ))}
      {ptsB.map(([x, y], i) => (
        <circle key={`b${i}`} cx={x} cy={y} r="3" fill={colorB} />
      ))}
    </svg>
  );
}

export default function SignupAnalyticsPanel() {
  const [data, setData] = useState<SignupData | null>(null);
  const [loading, setLoading] = useState(false);

  const [timeFilter, setTimeFilter] = useState("all");
  const [chartType, setChartType] = useState("bar");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [dateError, setDateError] = useState("");

  const [tooltip, setTooltip] = useState<{ point: TrendPoint; x: number; y: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timeFilter === "custom") {
      if (!startDate || !endDate) return;
      if (new Date(startDate) > new Date(endDate)) {
        setDateError("Start date must be before end date");
        return;
      }
      setDateError("");
    } else {
      setDateError("");
    }

    let url = `${API_URL}/api/admin/analytics/signups?time_filter=${timeFilter}`;
    if (timeFilter === "custom" && startDate && endDate) {
      url += `&start_date=${startDate}T00:00:00Z&end_date=${endDate}T23:59:59Z`;
    }

    setLoading(true);
    fetch(url, { headers: { "X-Admin-Key": ADMIN_KEY } })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch((e) => console.error("Signup analytics fetch error", e))
      .finally(() => setLoading(false));
  }, [timeFilter, startDate, endDate]);

  const trend = data?.trend ?? [];
  const maxVal = trend.length > 0 ? Math.max(...trend.map((d) => Math.max(d.signups, d.paid)), 1) : 1;

  return (
    <div className="bg-white rounded-[1.5rem] p-6 border border-[#eff1f2] shadow-sm space-y-6">
      {/* ── Header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl font-bold text-[#2c2f30] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#006859]" />
            Signup &amp; Conversion Tracking
          </h2>
          <p className="text-sm text-[#595c5d] mt-0.5">
            New signups · paid users · conversion rate over time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Chart type selector */}
          <div className="flex items-center bg-[#eff1f2] p-1 rounded-xl gap-1">
            {CHART_TYPES.map((ct) => {
              const Icon = ct.icon;
              return (
                <button
                  key={ct.id}
                  onClick={() => setChartType(ct.id)}
                  title={ct.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    chartType === ct.id
                      ? "bg-white text-[#006859] shadow-sm"
                      : "text-[#595c5d] hover:text-[#2c2f30]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {ct.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Time filter ──────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 bg-[#f8fffe] border border-[#006859]/10 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[#595c5d] uppercase tracking-wider">Period:</span>
          <div className="flex flex-wrap bg-[#eff1f2] p-1 rounded-xl gap-1">
            {TIME_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTimeFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  timeFilter === f.id
                    ? "bg-white text-[#006859] shadow-sm"
                    : "text-[#595c5d] hover:text-[#2c2f30]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {timeFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#eff1f2]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#595c5d]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-medium px-2 py-1 rounded-lg border border-[#eff1f2] outline-none focus:border-[#006859]"
              />
              <span className="text-xs text-[#595c5d]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-medium px-2 py-1 rounded-lg border border-[#eff1f2] outline-none focus:border-[#006859]"
              />
            </div>
            {dateError && <span className="text-xs font-bold text-red-500">{dateError}</span>}
          </div>
        )}
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Signups */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden bg-gradient-to-br from-[#006859] to-[#0d9e84] rounded-2xl p-5 text-white"
        >
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="text-xs font-bold uppercase tracking-wider opacity-75 flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5" /> Total Signups
          </div>
          <div className="text-3xl font-black font-headline">
            {loading ? "—" : (data?.total_signups ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] opacity-60 mt-1">
            {timeFilter === "today" ? "today" : timeFilter === "week" ? "last 7 days" : timeFilter === "month" ? "last 30 days" : timeFilter === "custom" ? "custom range" : "all time"}
          </div>
        </motion.div>

        {/* Paid Users */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="relative overflow-hidden bg-gradient-to-br from-amber-500 to-amber-400 rounded-2xl p-5 text-white"
        >
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
          <div className="text-xs font-bold uppercase tracking-wider opacity-75 flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5" /> Paid Users
          </div>
          <div className="text-3xl font-black font-headline">
            {loading ? "—" : (data?.total_paid ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] opacity-60 mt-1">signed up in period · ever paid</div>
        </motion.div>

        {/* Conversion Rate */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className={`relative overflow-hidden rounded-2xl p-5 border ${
            (data?.conversion_rate ?? 0) >= 5
              ? "bg-emerald-50 border-emerald-200"
              : (data?.conversion_rate ?? 0) >= 2
              ? "bg-amber-50 border-amber-200"
              : "bg-[#eff1f2] border-[#e0e2e3]"
          }`}
        >
          <div className="text-xs font-bold uppercase tracking-wider text-[#595c5d] flex items-center gap-1.5 mb-2">
            <Percent className="w-3.5 h-3.5" /> Conversion Rate
          </div>
          <div className={`text-3xl font-black font-headline ${
            (data?.conversion_rate ?? 0) >= 5 ? "text-emerald-700" :
            (data?.conversion_rate ?? 0) >= 2 ? "text-amber-700" : "text-[#2c2f30]"
          }`}>
            {loading ? "—" : `${data?.conversion_rate ?? 0}%`}
          </div>
          <div className="text-[10px] text-[#595c5d]/70 mt-1">
            paid ÷ signups · {(data?.conversion_rate ?? 0) >= 5 ? "🟢 Healthy" : (data?.conversion_rate ?? 0) >= 2 ? "🟡 Growing" : "⚪ Early stage"}
          </div>
        </motion.div>

        {/* Delayed Converters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24 }}
          className="relative overflow-hidden rounded-2xl p-5 border bg-violet-50 border-violet-200"
        >
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-violet-100/60" />
          <div className="text-xs font-bold uppercase tracking-wider text-violet-600 flex items-center gap-1.5 mb-2">
            <Calendar className="w-3.5 h-3.5" /> Delayed Converters
          </div>
          <div className="text-3xl font-black font-headline text-violet-700">
            {loading ? "—" : (data?.delayed_converters ?? 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-violet-500/80 mt-1">
            signed up &amp; paid on different day
          </div>
        </motion.div>
      </div>

      {/* ── Chart ─────────────────────────────────────────── */}
      <div className="pt-4 border-t border-[#eff1f2]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-[#2c2f30]">Signups vs Paid Users</h3>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-bold text-[#595c5d]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#006859]" /> Signups
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Paid
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-36 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#006859] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trend.length === 0 ? (
          <div className="h-36 flex items-center justify-center text-sm text-[#595c5d]">
            No data for selected period
          </div>
        ) : chartType === "bar" ? (
          /* ── Bar Chart ── */
          <div className="relative" ref={chartRef}>
            <div className="flex items-end gap-1 sm:gap-1.5 h-44">
              {trend.map((d, i) => {
                const sH = maxVal > 0 ? (d.signups / maxVal) * 100 : 0;
                const pH  = maxVal > 0 ? (d.paid   / maxVal) * 100 : 0;
                return (
                  <div
                    key={`sb-${i}`}
                    className="flex-1 flex flex-col items-center gap-0.5 h-full group cursor-pointer"
                    onMouseEnter={(e) => {
                      const rect = chartRef.current?.getBoundingClientRect();
                      if (rect) setTooltip({ point: d, x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    {/* bars side by side */}
                    <div className="relative w-full flex items-end justify-center gap-[1px] h-full">
                      <motion.div
                        key={`sbar-${i}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${sH}%` }}
                        transition={{ duration: 0.5, delay: i * 0.02, ease: "easeOut" }}
                        className="w-[45%] rounded-t-sm bg-gradient-to-t from-[#006859] to-[#12f8d7] group-hover:opacity-80 transition-opacity min-h-[2px]"
                      />
                      <motion.div
                        key={`pbar-${i}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${pH}%` }}
                        transition={{ duration: 0.5, delay: i * 0.02 + 0.05, ease: "easeOut" }}
                        className="w-[45%] rounded-t-sm bg-gradient-to-t from-amber-500 to-amber-300 group-hover:opacity-80 transition-opacity min-h-[2px]"
                      />
                    </div>
                    <span className="text-[8px] sm:text-[9px] font-medium text-[#595c5d] truncate w-full text-center">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Tooltip */}
            <AnimatePresence>
              {tooltip && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="pointer-events-none absolute z-20 bg-[#0b1e19] text-white rounded-xl px-3 py-2 text-xs font-bold shadow-xl"
                  style={{ left: tooltip.x + 10, top: tooltip.y - 40 }}
                >
                  <div className="opacity-60 text-[10px] mb-0.5">{tooltip.point.label}</div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#12f8d7] shrink-0" />
                    {tooltip.point.signups} signups
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    {tooltip.point.paid} paid
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ── Line / Area Chart ── */
          <div className="relative h-44 w-full" ref={chartRef}>
            <PolylineChart
              data={trend}
              seriesA="signups"
              seriesB="paid"
              colorA="#006859"
              colorB="#f59e0b"
              isArea={true}
            />
            {/* x-axis labels */}
            <div className="flex justify-between px-8 -mt-1">
              {trend
                .filter((_, i) => trend.length <= 12 || i % Math.ceil(trend.length / 12) === 0)
                .map((d, i) => (
                  <span key={i} className="text-[8px] sm:text-[9px] text-[#595c5d] font-medium">
                    {d.label}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Insight footer ─────────────────────────────────── */}
      {data && data.total_signups > 0 && (
        <div className="pt-3 border-t border-[#eff1f2] flex flex-wrap items-center gap-4 text-xs text-[#595c5d]">
          <span>
            <b className="text-[#2c2f30]">{data.total_signups}</b> signed up →{" "}
            <b className="text-[#2c2f30]">{data.total_paid}</b> paid →{" "}
            <b className={data.conversion_rate >= 5 ? "text-emerald-600" : data.conversion_rate >= 2 ? "text-amber-600" : "text-[#2c2f30]"}>
              {data.conversion_rate}% conversion
            </b>
          </span>
          <span className="text-[#595c5d]/50">|</span>
          <span>
            {data.total_signups - data.total_paid} free users still to convert
          </span>
        </div>
      )}
    </div>
  );
}
