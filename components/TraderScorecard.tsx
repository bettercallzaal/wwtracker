"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { sampleTraderPnl } from "@/lib/traderSample";
import { WW } from "@/lib/wwData";
import { usd } from "@/lib/price";
import { TRADERS, ME_WALLET } from "@/lib/traders";

// ---------------------------------------------------------------------------
// Known trader figures (from the WaveWarZ stats app). These are seeded until
// the live Dune query for this wallet's battle trades is wired in.
// ---------------------------------------------------------------------------

const TRADER = {
  wallet: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
  program: "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo",
  netPnlSol: -1.6493,
  netPnlUsd: -111.36,
  roiPct: -30.67,
  battles: 1000,
  rank: 1,
  solUsd: 67.52,
} as const;

const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;

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

export default function TraderScorecard() {
  const reducedMotion = useReducedMotion();

  // Real cumulative SOL PnL from on-chain (every WaveWarZ tx's net SOL delta).
  // Falls back to the deterministic sample if the snapshot is empty.
  const live = WW.pnl.length > 0;
  const data = useMemo(() => {
    if (live) {
      return WW.pnl.map((p, i) => ({ battle: i + 1, cumPnl: p.cum }));
    }
    return sampleTraderPnl(120, TRADER.netPnlSol);
  }, [live]);

  const onChainNet = live ? WW.pnl[WW.pnl.length - 1].cum : TRADER.netPnlSol;
  const ts = WW.traderStats;
  const official = TRADERS.find((t) => t.wallet === ME_WALLET);

  const fmt = (n: number, dp = 2) =>
    n.toLocaleString(undefined, {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });

  const down = onChainNet < 0;
  const pnlColor = down ? C.danger : C.good;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* header */}
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
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / my trades</span>
        </h1>
        <span
          title={TRADER.wallet}
          style={{
            fontFamily: C.mono,
            fontSize: 11,
            letterSpacing: "0.06em",
            padding: "4px 10px",
            borderRadius: 999,
            background: C.elev,
            color: C.dim,
          }}
        >
          {short(TRADER.wallet)}
        </span>
      </div>

      {/* hero: net realized PnL */}
      <section
        style={{
          background: `linear-gradient(135deg, ${C.panel}, ${C.elev})`,
          border: `1px solid ${C.grid}`,
          borderRadius: 16,
          padding: "clamp(18px, 4vw, 32px)",
        }}
      >
        <p style={metaLabel}>NET ON-CHAIN SOL PnL ON WAVEWARZ</p>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: "clamp(34px, 9vw, 64px)",
            fontWeight: 700,
            lineHeight: 1,
            color: pnlColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {down ? "" : "+"}
          {fmt(onChainNet)}
          <span style={{ fontSize: "0.4em", color: C.text, marginLeft: 10 }}>◎</span>
        </p>
        <p style={{ margin: "6px 0 0", fontFamily: C.mono, fontSize: 13, color: C.dim }}>
          {down ? "-" : "+"}
          {usd(onChainNet)}
        </p>
        <p
          style={{
            margin: "10px 0 0",
            fontFamily: C.mono,
            fontSize: 13,
            color: C.dim,
          }}
        >
          Net SOL across {WW.pnl.length ? "all WaveWarZ txs" : "battles"} since
          Aug 2025. Stats-app realized PnL:{" "}
          <span style={{ color: pnlColor }}>{fmt(TRADER.netPnlSol)} ◎</span> /{" "}
          {fmt(TRADER.roiPct, 2)}% over {TRADER.battles.toLocaleString()} battles
          (the gap is open/unclaimed positions + methodology).
        </p>
      </section>

      {/* PnL three ways - reconcile the different figures */}
      <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
        <span style={metaLabel}>NET PnL - THREE WAYS (THEY MEASURE DIFFERENT THINGS)</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
          {official && (
            <PnlCard
              value={`${official.pnl >= 0 ? "+" : ""}${fmt(official.pnl)} ◎`}
              label="OFFICIAL (wavewarz.info)"
              note={`payout received - SOL invested. Rank #${official.rank}/${TRADERS.length}, ${official.win}% win (${official.rec}).`}
              color={official.pnl >= 0 ? C.good : C.danger}
            />
          )}
          <PnlCard
            value={`${fmt(onChainNet)} ◎`}
            label="ON-CHAIN FLOW"
            note="net SOL across all your WaveWarZ txs (includes fees + gas). The curve below."
            color={onChainNet >= 0 ? C.good : C.danger}
          />
          <PnlCard
            value={`${fmt(TRADER.netPnlSol)} ◎`}
            label="STATS-APP REALIZED"
            note={`-${fmt(Math.abs(TRADER.roiPct), 2)}% ROI over ${TRADER.battles.toLocaleString()} battles (per the leaderboard widget).`}
            color={C.danger}
          />
        </div>
      </section>

      {/* tiles - real on-chain trade stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <Tile label="WIN RATE">
          {fmt(ts.winRate, 1)}%
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            {ts.winTxs}W / {ts.lossTxs}L
          </small>
        </Tile>
        <Tile label="SOL BET">
          {fmt(ts.solBet)} ◎
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{usd(ts.solBet)}</small>
        </Tile>
        <Tile label="SOL RETURNED">
          {fmt(ts.solReturned)} ◎
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{usd(ts.solReturned)}</small>
        </Tile>
        <Tile label="BIGGEST WIN">
          <span style={{ color: C.good }}>+{fmt(ts.biggestWin)} ◎</span>
        </Tile>
        <Tile label="BIGGEST LOSS">
          <span style={{ color: C.danger }}>{fmt(ts.biggestLoss)} ◎</span>
        </Tile>
        <Tile label="BATTLES (STATS APP)">{TRADER.battles.toLocaleString()}</Tile>
      </div>

      {WW.volume.total > 0 && (
        <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
          Platform footprint: your {fmt(ts.solBet)} ◎ committed is{" "}
          <span style={{ color: C.accent }}>
            {fmt((ts.solBet / WW.volume.total) * 100, 1)}%
          </span>{" "}
          of all {fmt(WW.volume.total)} ◎ WaveWarZ buy volume.
        </p>
      )}

      {/* cumulative PnL chart */}
      <section
        aria-label="Cumulative realized PnL over battles"
        style={{
          background: C.panel,
          border: `1px solid ${C.grid}`,
          borderRadius: 16,
          padding: "16px 8px 8px",
        }}
      >
        <div style={{ padding: "0 8px 12px" }}>
          <span style={metaLabel}>
            CUMULATIVE SOL PnL{live ? " (LIVE, ON-CHAIN)" : " (SAMPLE)"}
          </span>
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.danger} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={C.danger} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="battle"
                tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                tickLine={false}
                axisLine={{ stroke: C.grid }}
                minTickGap={48}
              />
              <YAxis
                tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                tickLine={false}
                axisLine={false}
                width={56}
                tickFormatter={(v: number) => fmt(v, 1)}
              />
              <Tooltip
                contentStyle={{
                  background: C.bg,
                  border: `1px solid ${C.grid}`,
                  borderRadius: 10,
                  fontFamily: C.mono,
                  fontSize: 12,
                }}
                labelStyle={{ color: C.dim }}
                itemStyle={{ color: C.danger }}
                labelFormatter={(l) => `battle ${l}`}
                formatter={(v: number | string) => [`${fmt(Number(v))} ◎`, "cum PnL"]}
              />
              <ReferenceLine y={0} stroke={C.dim} strokeDasharray="4 4" />
              <Area
                type="monotone"
                dataKey="cumPnl"
                stroke={C.danger}
                strokeWidth={2}
                fill="url(#pnlFill)"
                isAnimationActive={!reducedMotion}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* monthly net PnL */}
      {WW.pnlMonthly.length > 0 && (
        <section
          aria-label="Monthly net SOL PnL"
          style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: "16px 8px 8px" }}
        >
          <div style={{ padding: "0 8px 12px" }}>
            <span style={metaLabel}>MONTHLY NET SOL PnL</span>
          </div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WW.pnlMonthly} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} />
                <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v, 1)} />
                <Tooltip
                  cursor={{ fill: "rgba(255,194,75,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string) => [`${fmt(Number(v))} ◎`, "net"]}
                />
                <ReferenceLine y={0} stroke={C.dim} />
                <Bar dataKey="net" isAnimationActive={!reducedMotion} radius={[2, 2, 0, 0]}>
                  {WW.pnlMonthly.map((m, i) => (
                    <Cell key={i} fill={m.net >= 0 ? C.good : C.danger} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* biggest moves */}
      {WW.traderTop.wins.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <MovesPanel label="BIGGEST WINS" moves={WW.traderTop.wins} color={C.good} sign="+" fmt={fmt} />
          <MovesPanel label="BIGGEST LOSSES" moves={WW.traderTop.losses} color={C.danger} sign="" fmt={fmt} />
        </div>
      )}

      {/* data-source note */}
      <p
        style={{
          margin: 0,
          fontFamily: C.mono,
          fontSize: 12,
          color: C.dim,
          lineHeight: 1.5,
        }}
      >
        Curve is your real cumulative net SOL across {WW.pnl.length} sampled
        WaveWarZ txs on program{" "}
        <span style={{ color: C.text }}>{short(TRADER.program)}</span> (518 total,
        Aug 2025 - Jun 2026). Volume + win rate are next, via buyShares/sellShares
        instruction decode. See docs/WAVEWARZ-RESEARCH.md.
      </p>
    </div>
  );
}

function PnlCard({ value, label, note, color }: { value: string; label: string; note: string; color: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 24, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11, lineHeight: 1.5 }}>{note}</span>
    </div>
  );
}

function MovesPanel({
  label,
  moves,
  color,
  sign,
  fmt,
}: {
  label: string;
  moves: { t: string; sol: number }[];
  color: string;
  sign: string;
  fmt: (n: number, dp?: number) => string;
}) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16 }}>
      <span style={metaLabel}>{label}</span>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontFamily: C.mono, fontSize: 13 }}>
        <tbody>
          {moves.map((m, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${C.grid}` }}>
              <td style={{ padding: "7px 0", color: C.dim }}>{m.t}</td>
              <td style={{ padding: "7px 0", textAlign: "right", color, fontVariantNumeric: "tabular-nums" }}>
                {sign}
                {fmt(m.sol)} ◎
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
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
