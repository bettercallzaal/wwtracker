"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";

interface VolDay {
  date: string;
  buy: number;
  sell: number;
}
type Basis = "buy" | "both";

const fmt = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function PlatformGrowth() {
  const [days, setDays] = useState<VolDay[] | null>(null);
  const [basis, setBasis] = useState<Basis>("both");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ww-platform-volume.json")
      .then((r) => r.json())
      .then((d: VolDay[]) => alive && setDays(d))
      .catch(() => alive && setError("Could not load platform volume."));
    return () => {
      alive = false;
    };
  }, []);

  // Sell-side per-day volume can't be pulled all-time on free-tier Dune (the
  // sellShares -> account_activity join exceeds the 2-min execution cap). When
  // real per-day sell data is absent we estimate both-sides by scaling buy-side
  // to the platform's reported buy:sell split (~324 buy : ~160 sell = 0.49).
  const SELL_RATIO = 0.49;
  const hasRealSell = useMemo(() => !!days && days.some((d) => d.sell > 0), [days]);
  const effBasis = basis;
  const estimated = basis === "both" && !hasRealSell;

  const data = useMemo(() => {
    if (!days) return null;
    let cum = 0;
    const series = days.map((d) => {
      const daily =
        effBasis === "buy" ? d.buy : hasRealSell ? d.buy + d.sell : d.buy * (1 + SELL_RATIO);
      cum += daily;
      return { date: d.date, daily: Math.round(daily * 1000) / 1000, cum: Math.round(cum * 1000) / 1000 };
    });
    const total = cum;
    const peak = series.reduce((m, d) => (d.daily > m.daily ? d : m), { date: "-", daily: 0, cum: 0 });
    const activeDays = series.filter((d) => d.daily > 0).length;
    const first = series[0]?.date ?? "-";
    const last = series[series.length - 1]?.date ?? "-";
    return { series, total, peak, activeDays, first, last };
  }, [days, effBasis, hasRealSell]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 34px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / platform growth</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Total SOL traded on the WaveWarZ battle contract since launch - the
          cumulative line only climbs. Decoded on-chain from program 9TUf via Dune.
        </p>
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...metaLabel, fontSize: 11 }}>VOLUME BASIS</span>
        <Toggle active={effBasis === "both"} onClick={() => setBasis("both")} label={estimated ? "BOTH SIDES (EST.)" : "BOTH SIDES"} />
        <Toggle active={effBasis === "buy"} onClick={() => setBasis("buy")} label="BUY-SIDE" />
      </div>

      {error && <p style={{ color: C.danger, fontFamily: C.mono, fontSize: 13 }}>{error}</p>}

      {!data && !error ? (
        <div className="skeleton-shimmer" style={{ height: 320, borderRadius: 16 }} />
      ) : data ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Tile label={effBasis === "buy" ? "TOTAL BUY VOLUME" : estimated ? "TOTAL VOLUME (EST. BUY+SELL)" : "TOTAL VOLUME (BUY+SELL)"}>
              <span style={{ color: C.accent }}>{fmt(data.total, 1)} ◎</span>
            </Tile>
            <Tile label="ACTIVE DAYS">{fmt(data.activeDays)}</Tile>
            <Tile label="PEAK DAY">
              {fmt(data.peak.daily, 1)} ◎
              <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{data.peak.date}</small>
            </Tile>
            <Tile label="AVG / ACTIVE DAY">{fmt(data.total / Math.max(1, data.activeDays), 2)} ◎</Tile>
          </div>

          <Panel label={`CUMULATIVE VOLUME - ${fmt(data.total, 1)} ◎ SINCE ${data.first}`}>
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.accent} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C.accent} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                  <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v, 0)} />
                  <Tooltip
                    contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                    labelStyle={{ color: C.dim }}
                    formatter={(v: number | string) => [`${fmt(Number(v), 1)} ◎`, "cumulative"]}
                  />
                  <Area type="monotone" dataKey="cum" stroke={C.accent} strokeWidth={2} fill="url(#volFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel label="DAILY VOLUME (◎)">
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                  <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={36} tickFormatter={(v: number) => fmt(v, 0)} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,194,75,0.08)" }}
                    contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                    labelStyle={{ color: C.dim }}
                    formatter={(v: number | string) => [`${fmt(Number(v), 2)} ◎`, "volume"]}
                  />
                  <Bar dataKey="daily" fill={C.accent} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
            {effBasis === "buy"
              ? "Buy-side: SOL committed on buyShares txs (includes ~1.5% fees + gas) - fully on-chain, exact."
              : estimated
                ? "Both-sides (estimated): buy-side scaled to the platform's reported buy:sell split (~0.49 sell per buy). Exact per-day sell-side needs a paid Dune tier - the sellShares join exceeds the free 2-min execution cap. Toggle to BUY-SIDE for the exact on-chain series."
                : "Both-sides: buyShares SOL committed + sellShares SOL returned - the full traded volume the platform reports."}{" "}
            On-chain via Dune over program 9TUf. Range {data.first} to {data.last}.
          </p>
        </>
      ) : null}
    </div>
  );
}

function Toggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontFamily: C.mono,
        fontSize: 12,
        letterSpacing: "0.06em",
        padding: "7px 14px",
        borderRadius: 8,
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

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={metaLabel}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{children}</span>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>{label}</span>
      </div>
      {children}
    </section>
  );
}
