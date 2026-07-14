"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sampleBalances } from "@/lib/sampleData";
import { usd } from "@/lib/price";
import { C, metaLabel } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Operating floor: founders skim the excess above this back to ~3.5 SOL. */
const FLOOR = 3.5;

interface BalanceRow {
  block_date: string;
  eod_sol_balance: number;
  day_high?: number;
}

type Status = "loading" | "live" | "sample" | "error";
type Grain = "day" | "week";

interface ApiResponse {
  rows?: BalanceRow[];
  source?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// ---------------------------------------------------------------------------
// Aggregation: collapse daily rows to weekly closing balance (last day of week).
// ---------------------------------------------------------------------------

function toWeekly(rows: BalanceRow[]): BalanceRow[] {
  const byWeek = new Map<string, BalanceRow>();
  for (const r of rows) {
    const d = new Date(`${r.block_date}T00:00:00Z`);
    const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
    const toMonday = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() + toMonday);
    const key = monday.toISOString().slice(0, 10);
    // rows ascending: last write = week close; day_high carries the week's peak.
    const prev = byWeek.get(key);
    const high = Math.max(prev?.day_high ?? 0, r.day_high ?? r.eod_sol_balance);
    byWeek.set(key, {
      block_date: key,
      eod_sol_balance: r.eod_sol_balance,
      day_high: high,
    });
  }
  return Array.from(byWeek.values()).sort((a, b) =>
    a.block_date.localeCompare(b.block_date),
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BalanceDashboard() {
  const reducedMotion = useReducedMotion();

  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [grain, setGrain] = useState<Grain>("day");

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/balance", { cache: "no-store" });
      if (res.status === 503) {
        setRows(sampleBalances());
        setStatus("sample");
        return;
      }
      const data = (await res.json()) as ApiResponse;
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      const got = Array.isArray(data.rows) ? data.rows : [];
      if (got.length === 0) {
        setRows(sampleBalances());
        setStatus("sample");
        return;
      }
      setRows(got);
      setStatus("live");
    } catch (err) {
      // Default load failure -> degrade to sample rather than a blank screen.
      setErrorMsg(err instanceof Error ? err.message : "Failed to load.");
      setRows(sampleBalances());
      setStatus("sample");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const series = useMemo(
    () => (grain === "week" ? toWeekly(rows) : rows),
    [rows, grain],
  );

  const chartData = useMemo(
    () =>
      series.map((r) => ({
        date: r.block_date,
        balance: r.eod_sol_balance,
        high: r.day_high ?? r.eod_sol_balance,
      })),
    [series],
  );

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return { current: 0, change30: 0, change30Pct: 0, ath: 0, days: 0 };
    }
    const current = rows[rows.length - 1].eod_sol_balance;
    const idx30 = Math.max(0, rows.length - 31);
    const prior = rows[idx30].eod_sol_balance;
    const change30 = current - prior;
    const change30Pct = prior !== 0 ? (change30 / prior) * 100 : 0;
    // ATH uses intraday highs - peaks that get skimmed before close still count.
    const ath = rows.reduce(
      (m, r) => Math.max(m, r.day_high ?? r.eod_sol_balance),
      0,
    );
    return { current, change30, change30Pct, ath, days: rows.length };
  }, [rows]);

  const fmt = (n: number, dp = 2) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Header status={status} />

      {status === "loading" ? (
        <Skeletons />
      ) : (
        <>
          <Hero balance={stats.current} isSample={status === "sample"} fmt={fmt} />
          <StatTiles
            change30={stats.change30}
            change30Pct={stats.change30Pct}
            ath={stats.ath}
            days={stats.days}
            fmt={fmt}
          />
          <ChartCard
            grain={grain}
            setGrain={setGrain}
            data={chartData}
            reducedMotion={reducedMotion}
            fmt={fmt}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({ status }: { status: Status }) {
  const badge =
    status === "live"
      ? { label: "LIVE", bg: "#1f3a2a", fg: C.good }
      : status === "sample"
        ? { label: "SAMPLE", bg: C.elev, fg: C.dim }
        : status === "error"
          ? { label: "ERROR", bg: "#3a1f24", fg: C.danger }
          : { label: "LOADING", bg: C.elev, fg: C.dim };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: "clamp(20px, 4vw, 28px)",
          letterSpacing: "-0.02em",
        }}
      >
        WaveWarZ
        <span style={{ color: C.dim, fontWeight: 400 }}> / dev wallet</span>
      </h1>
      <span
        role="status"
        aria-live="polite"
        style={{
          fontFamily: C.mono,
          fontSize: 11,
          letterSpacing: "0.08em",
          padding: "4px 10px",
          borderRadius: 999,
          background: badge.bg,
          color: badge.fg,
        }}
      >
        {badge.label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero - current balance framed against the 3.5 floor
// ---------------------------------------------------------------------------

function Hero({
  balance,
  isSample,
  fmt,
}: {
  balance: number;
  isSample: boolean;
  fmt: (n: number, dp?: number) => string;
}) {
  const above = balance - FLOOR;
  const atFloor = above >= 0;
  const pct = Math.max(0, Math.min(1, balance / FLOOR));

  return (
    <section
      style={{
        background: `linear-gradient(135deg, ${C.panel}, ${C.elev})`,
        border: `1px solid ${C.grid}`,
        borderRadius: 16,
        padding: "clamp(18px, 4vw, 32px)",
      }}
    >
      <p style={metaLabel}>CURRENT BALANCE{isSample ? " (SAMPLE)" : ""}</p>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: "clamp(34px, 9vw, 64px)",
          fontWeight: 700,
          lineHeight: 1,
          color: C.accent,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmt(balance)}
        <span style={{ fontSize: "0.4em", color: C.text, marginLeft: 10 }}>◎</span>
      </p>
      <p style={{ margin: "6px 0 0", fontFamily: C.mono, fontSize: 13, color: C.dim }}>
        {usd(balance)}
      </p>

      <p
        style={{
          margin: "12px 0 0",
          fontSize: 13,
          fontFamily: C.mono,
          color: atFloor ? C.good : C.dim,
        }}
      >
        {atFloor
          ? `+${fmt(above)} ◎ above the ${FLOOR} floor`
          : `${fmt(FLOOR - balance)} ◎ to reach the ${FLOOR} floor`}
      </p>

      {/* progress-to-floor meter */}
      <div
        style={{
          marginTop: 10,
          height: 8,
          borderRadius: 999,
          background: C.bg,
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={FLOOR}
        aria-valuenow={Math.round(balance * 100) / 100}
        aria-label={`Progress to ${FLOOR} SOL floor`}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: "100%",
            background: atFloor ? C.good : C.accent,
          }}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Stat tiles
// ---------------------------------------------------------------------------

function StatTiles({
  change30,
  change30Pct,
  ath,
  days,
  fmt,
}: {
  change30: number;
  change30Pct: number;
  ath: number;
  days: number;
  fmt: (n: number, dp?: number) => string;
}) {
  const up = change30 >= 0;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: 12,
      }}
    >
      <Tile label="30D CHANGE">
        <span style={{ color: up ? C.good : C.danger }}>
          {up ? "+" : ""}
          {fmt(change30)} ◎
        </span>
        <small style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          {up ? "+" : ""}
          {fmt(change30Pct, 1)}%
        </small>
      </Tile>
      <Tile label="ALL-TIME HIGH">
        {fmt(ath)} ◎
        <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{usd(ath)}</small>
      </Tile>
      <Tile label="DAYS TRACKED">{days}</Tile>
    </div>
  );
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.grid}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={metaLabel}>{label}</span>
      <span
        style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
      >
        {children}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart card - bar chart with Day | Week toggle + 3.5 floor reference line
// ---------------------------------------------------------------------------

interface ChartPoint {
  date: string;
  balance: number;
  high: number;
}

function ChartCard({
  grain,
  setGrain,
  data,
  reducedMotion,
  fmt,
}: {
  grain: Grain;
  setGrain: (g: Grain) => void;
  data: ChartPoint[];
  reducedMotion: boolean;
  fmt: (n: number, dp?: number) => string;
}) {
  return (
    <section
      aria-label={`End-of-day SOL balance, by ${grain}`}
      style={{
        background: C.panel,
        border: `1px solid ${C.grid}`,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <span style={metaLabel}>END-OF-DAY BALANCE</span>
        <div role="radiogroup" aria-label="Time granularity" style={{ display: "flex", gap: 6 }}>
          <GrainToggle active={grain === "day"} onClick={() => setGrain("day")} label="DAY" />
          <GrainToggle active={grain === "week"} onClick={() => setGrain("week")} label="WEEK" />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>
          bars = daily close - line = intraday high (peaks skimmed before close)
        </span>
      </div>
      <div style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
              tickLine={false}
              axisLine={{ stroke: C.grid }}
              minTickGap={48}
            />
            <YAxis
              tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => fmt(v, 1)}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,194,75,0.08)" }}
              contentStyle={{
                background: C.bg,
                border: `1px solid ${C.grid}`,
                borderRadius: 10,
                fontFamily: C.mono,
                fontSize: 12,
              }}
              labelStyle={{ color: C.dim }}
              formatter={(v: number | string, name) => [
                `${fmt(Number(v))} ◎`,
                name === "high" ? "intraday high" : "close",
              ]}
            />
            <ReferenceLine
              y={FLOOR}
              stroke={C.accent}
              strokeDasharray="5 4"
              label={{
                value: `floor ${FLOOR}`,
                position: "insideTopRight",
                fill: C.accent,
                fontSize: 11,
                fontFamily: C.mono,
              }}
            />
            <Bar dataKey="balance" isAnimationActive={!reducedMotion} radius={[2, 2, 0, 0]}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.balance >= FLOOR ? C.good : C.accent}
                  fillOpacity={d.balance >= FLOOR ? 0.9 : 0.7}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="high"
              stroke={C.text}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={!reducedMotion}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function GrainToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={{
        fontFamily: C.mono,
        fontSize: 12,
        letterSpacing: "0.04em",
        padding: "7px 14px",
        borderRadius: 9,
        cursor: "pointer",
        border: `1px solid ${active ? C.accent : C.grid}`,
        background: active ? C.accent : "transparent",
        color: active ? "#1a1206" : C.text,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeletons
// ---------------------------------------------------------------------------

function Skeletons() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading balance data"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div className="skeleton-shimmer" style={{ height: 140, borderRadius: 16 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-shimmer" style={{ height: 84, borderRadius: 12 }} />
        ))}
      </div>
      <div className="skeleton-shimmer" style={{ height: 392, borderRadius: 16 }} />
    </div>
  );
}
