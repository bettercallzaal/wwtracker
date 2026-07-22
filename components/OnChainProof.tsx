"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { WW } from "@/lib/wwData";
import { getPublicStats, type PublicStats } from "@/lib/wavewarzApi";

// The overview overlays four on-chain series that live on wildly different
// scales (325 SOL of volume vs a ~3.5 SOL treasury vs thousands of trades).
// Putting them on one axis honestly means indexing each to its own peak = 100%,
// then showing the real number in the tooltip. One shared time axis, no dual-y.

interface BalanceRow {
  block_date: string;
  eod_sol_balance: number;
  day_high?: number;
}

interface SeriesDef {
  id: "vol" | "bal" | "btl" | "trd";
  name: string;
  color: string;
  unit: string;
  dp: number;
}

const SERIES: SeriesDef[] = [
  { id: "vol", name: "Volume", color: C.accent, unit: " SOL", dp: 1 },
  { id: "bal", name: "Treasury", color: "#7ee0a0", unit: " SOL", dp: 2 },
  { id: "btl", name: "Battles", color: "#8ab4ff", unit: "", dp: 0 },
  { id: "trd", name: "Trades", color: "#c9a3ff", unit: "", dp: 0 },
];

const START = "2025-08-01";

interface Row {
  date: string;
  volPct: number | null;
  balPct: number | null;
  btlPct: number | null;
  trdPct: number | null;
  vol: number | null;
  bal: number | null;
  btl: number | null;
  trd: number | null;
}

const fmt = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const shortDate = (d: string) => {
  const [y, m] = d.split("-");
  const mn = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)];
  return m === "01" ? `${mn} '${y.slice(2)}` : mn;
};

export default function OnChainProof() {
  const [bal, setBal] = useState<BalanceRow[] | null>(null);
  const [balLive, setBalLive] = useState(false);
  const [active, setActive] = useState<Set<SeriesDef["id"]>>(new Set(["vol", "bal", "btl", "trd"]));
  const [liveStats, setLiveStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/balance", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { rows?: BalanceRow[]; source?: string }) => {
        if (!alive) return;
        setBal(d.rows ?? []);
        setBalLive(d.source !== "sample");
      })
      .catch(() => alive && setBal([]));
    getPublicStats()
      .then((s) => alive && setLiveStats(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const { rows, peaks, latest } = useMemo(() => {
    // cumulative volume by date
    const volMap = new Map<string, number>();
    let cv = 0;
    for (const p of WW.volume.series) {
      cv += p.vol;
      volMap.set(p.block_date, cv);
    }
    // cumulative battles + trades by date
    const btlMap = new Map<string, number>();
    const trdMap = new Map<string, number>();
    let cb = 0;
    let ct = 0;
    for (const p of WW.timeline) {
      cb += p.battles;
      ct += p.trades;
      btlMap.set(p.block_date, cb);
      trdMap.set(p.block_date, ct);
    }
    const balMap = new Map<string, number>();
    for (const b of bal ?? []) balMap.set(b.block_date, b.eod_sol_balance);

    const dates = Array.from(
      new Set([...volMap.keys(), ...btlMap.keys(), ...trdMap.keys(), ...balMap.keys()]),
    )
      .filter((d) => d >= START)
      .sort();

    const peak = {
      vol: Math.max(0, ...volMap.values()),
      bal: Math.max(0, ...[...balMap.entries()].filter(([d]) => d >= START).map(([, v]) => v)),
      btl: Math.max(0, ...btlMap.values()),
      trd: Math.max(0, ...trdMap.values()),
    };

    // carry-forward last known value so step series stay continuous
    let lv = 0;
    let lb: number | null = null;
    let lbt = 0;
    let lt = 0;
    const out: Row[] = dates.map((date) => {
      if (volMap.has(date)) lv = volMap.get(date)!;
      if (balMap.has(date)) lb = balMap.get(date)!;
      if (btlMap.has(date)) lbt = btlMap.get(date)!;
      if (trdMap.has(date)) lt = trdMap.get(date)!;
      return {
        date,
        vol: lv || null,
        bal: lb,
        btl: lbt || null,
        trd: lt || null,
        volPct: peak.vol ? (lv / peak.vol) * 100 : null,
        balPct: lb != null && peak.bal ? (lb / peak.bal) * 100 : null,
        btlPct: peak.btl ? (lbt / peak.btl) * 100 : null,
        trdPct: peak.trd ? (lt / peak.trd) * 100 : null,
      };
    });

    const last = out[out.length - 1];
    return { rows: out, peaks: peak, latest: last };
  }, [bal]);

  const toggle = (id: SeriesDef["id"]) =>
    setActive((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const tot = WW.platformStats;
  const prog = WW.program;
  const ts = WW.traderStats;

  // Volume and battle count come live from WaveWarZ's own public API
  // (wavewarz.info/api-docs) when it responds - always current, vs. the
  // baked Dune snapshot below which is only as fresh as its last regen.
  // Trades/traders/active-days have no live equivalent yet, so those stay
  // snapshot-sourced (labeled with the snapshot date in the footer).
  const tiles = [
    {
      k: "Total volume",
      v: liveStats ? fmt(liveStats.volume.totalSol, 1) : fmt(peaks.vol, 1),
      u: "SOL",
      s: liveStats ? "live from WaveWarZ API" : "decoded buy volume (snapshot)",
    },
    {
      k: "Treasury now",
      v: latest?.bal != null ? fmt(latest.bal, 2) : "-",
      u: "SOL",
      s: `floor 3.5 / peak ${fmt(peaks.bal, 2)}`,
    },
    {
      k: "Battles",
      v: liveStats ? fmt(liveStats.battles.total) : fmt(prog.battlesCreated),
      u: "",
      s: liveStats
        ? `${fmt(liveStats.battles.quickBattles)} quick / ${fmt(liveStats.battles.mainEvents)} events`
        : `${fmt(prog.battlesSettled)} settled (snapshot)`,
    },
    {
      k: "Artist payouts",
      v: liveStats ? fmt(liveStats.artistPayouts.totalSol, 2) : "-",
      u: "SOL",
      s: "live, automatic per-trade + settlement",
    },
    { k: "Trades", v: fmt(prog.buys + prog.sells), u: "", s: `${fmt(prog.buys)} buys / ${fmt(prog.sells)} sells` },
    { k: "Traders", v: "122", u: "", s: "unique wallets (snapshot)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 34px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / on-chain overview</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Every pool, fee, and payout settles on-chain, so here is the whole run in one
          place - volume, treasury, battles, trades - decoded from program 9TUf via Dune.
          Each line is scaled to its own peak so they share one axis; hover for the real number.
        </p>
      </header>

      <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim }}>
        For live battle-by-battle browsing, leaderboards, and song charts, WaveWarZ's own{" "}
        <a href="https://wavewarz-intelligence.vercel.app" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
          Intelligence dashboard ↗
        </a>{" "}
        already does that well - this tracker focuses on the treasury/financial history and
        record-keeping side instead.
      </p>

      {liveStats?.liveBattle != null && (
        <div
          style={{
            background: `${C.good}1a`,
            border: `1px solid ${C.good}`,
            borderRadius: 12,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: C.mono,
            fontSize: 12,
          }}
        >
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: C.good, display: "inline-block", flexShrink: 0 }}
          />
          <span style={{ color: C.good, fontWeight: 700 }}>LIVE NOW</span>
          <span style={{ color: C.text }}>a battle is trading right now on WaveWarZ.</span>
          <a href="https://wavewarz.info" target="_blank" rel="noreferrer" style={{ color: C.good, marginLeft: "auto", textDecoration: "none" }}>
            watch ↗
          </a>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 10,
        }}
      >
        {tiles.map((t) => (
          <div
            key={t.k}
            style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: "14px 14px 12px" }}
          >
            <div style={{ ...metaLabel, fontSize: 10 }}>{t.k.toUpperCase()}</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
              {t.v}
              {t.u && <span style={{ fontSize: 12, color: C.dim, fontWeight: 600, marginLeft: 3 }}>{t.u}</span>}
            </div>
            <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginTop: 4 }}>{t.s}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ ...metaLabel, fontSize: 11 }}>TOGGLE LINES</span>
        {SERIES.map((s) => {
          const on = active.has(s.id);
          const peakVal = peaks[s.id];
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: C.mono,
                fontSize: 12,
                padding: "7px 13px",
                borderRadius: 999,
                border: `1px solid ${on ? s.color : C.grid}`,
                background: C.panel,
                color: on ? C.text : C.dim,
                cursor: "pointer",
                opacity: on ? 1 : 0.5,
              }}
            >
              <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, display: "inline-block" }} />
              {s.name}
              <b style={{ color: C.text, fontWeight: 600 }}>
                {fmt(peakVal, s.dp)}
                {s.unit}
              </b>
            </button>
          );
        })}
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: "16px 8px 8px" }}>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="0" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              minTickGap={44}
              tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 11 }}
              stroke={C.grid}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 11 }}
              stroke={C.grid}
              width={44}
            />
            <Tooltip content={<ProofTooltip active2={active} />} />
            {SERIES.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={`${s.id}Pct`}
                name={s.id}
                stroke={s.color}
                strokeWidth={2.4}
                dot={false}
                hide={!active.has(s.id)}
                isAnimationActive={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ScaleCard
        title="Volume, from zero"
        note="cumulative SOL traded across every battle - the line only climbs."
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <defs>
              <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.accent} stopOpacity={0.32} />
                <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={44} tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 11 }} stroke={C.grid} />
            <YAxis tickFormatter={(v) => fmt(v, 0)} tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 11 }} stroke={C.grid} width={44} />
            <Tooltip
              contentStyle={{ background: C.elev, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
              labelStyle={{ color: C.dim }}
              itemStyle={{ color: C.text }}
              formatter={(v: number) => [`${fmt(v, 1)} SOL`, "Volume"]}
            />
            <Area type="monotone" dataKey="vol" stroke={C.accent} strokeWidth={2.2} fill="url(#volFill)" dot={false} isAnimationActive={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </ScaleCard>

      <ScaleCard
        title="The treasury, holding the floor"
        note={`0.5% of every trade + 3% of every loser pool. peaked at ${fmt(peaks.bal, 2)} SOL; sits above the 3.5 operating floor.`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
            <defs>
              <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7ee0a0" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#7ee0a0" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={44} tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 11 }} stroke={C.grid} />
            <YAxis domain={[0, "auto"]} tickFormatter={(v) => fmt(v, 1)} tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 11 }} stroke={C.grid} width={44} />
            <Tooltip
              contentStyle={{ background: C.elev, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
              labelStyle={{ color: C.dim }}
              itemStyle={{ color: C.text }}
              formatter={(v: number) => [`${fmt(v, 2)} SOL`, "Treasury"]}
            />
            <ReferenceLine y={3.5} stroke={C.accent} strokeDasharray="5 4" label={{ value: "3.5 floor", position: "insideTopRight", fill: C.accent, fontFamily: C.mono, fontSize: 11 }} />
            <Area type="monotone" dataKey="bal" stroke="#7ee0a0" strokeWidth={2.2} fill="url(#balFill)" dot={false} isAnimationActive={false} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </ScaleCard>

      <div
        style={{
          background: C.panel,
          border: `1px solid ${C.grid}`,
          borderRadius: 16,
          padding: "18px 20px",
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 16,
        }}
        className="proof-trader"
      >
        <div>
          <div style={{ ...metaLabel, fontSize: 10 }}>THE PART NOBODY SHOWS YOU - COFOUNDER PNL</div>
          <div style={{ fontSize: 40, fontWeight: 800, color: C.danger, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {fmt(ts.net, 2)} SOL
          </div>
          <p style={{ color: C.dim, fontSize: 14, margin: "10px 0 0", maxWidth: 380, lineHeight: 1.55 }}>
            {fmt(ts.txs)} trades. bet {fmt(ts.solBet, 1)} SOL, got {fmt(ts.solReturned, 1)} back. net
            negative, on-chain, in public - because that is the whole point.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 10px", alignContent: "center" }}>
          <Metric n={`${fmt(ts.winRate, 1)}%`} l="win rate" />
          <Metric n={`${fmt(ts.winTxs)}/${fmt(ts.lossTxs)}`} l="wins / losses" />
          <Metric n={`+${fmt(ts.biggestWin, 2)}`} l="biggest win (SOL)" />
          <Metric n={`${fmt(ts.biggestLoss, 2)}`} l="biggest loss (SOL)" />
        </div>
      </div>

      <p style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, margin: 0 }}>
        {balLive ? "treasury live from Solana." : "treasury on sample data (API unset)."}{" "}
        {liveStats ? "volume/battles/payouts live from WaveWarZ's API." : "volume and battles from the baked Dune snapshot."}{" "}
        trades and traders are from the Dune snapshot ({fmt(tot.activeDays)} active days through {tot.lastDay},
        generated {WW.generatedAt}). indexed chart, not dual-axis - see the DEV WALLET and BATTLES tabs for full-scale views.
      </p>
    </div>
  );
}

function ScaleCard({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: "16px 8px 12px" }}>
      <div style={{ padding: "0 8px 10px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</div>
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginTop: 3 }}>{note}</div>
      </div>
      {children}
    </div>
  );
}

function Metric({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</div>
      <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>{l}</div>
    </div>
  );
}

interface TooltipEntry {
  payload: Row;
}

function ProofTooltip({
  active,
  payload,
  active2,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  active2: Set<SeriesDef["id"]>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: C.elev,
        border: `1px solid ${C.grid}`,
        borderRadius: 10,
        padding: "9px 11px",
        fontFamily: C.mono,
        fontSize: 12,
      }}
    >
      <div style={{ color: C.dim, fontSize: 11, marginBottom: 5 }}>{row.date}</div>
      {SERIES.filter((s) => active2.has(s.id)).map((s) => {
        const raw = row[s.id];
        return (
          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, lineHeight: 1.7 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.text }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
              {s.name}
            </span>
            <span style={{ color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {raw == null ? "-" : `${fmt(raw, s.dp)}${s.unit}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
