"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { WW } from "@/lib/wwData";

// Known non-trader signers to exclude from the trader leaderboard.
const TREASURY = "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37";
const ME = "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk";

const short = (a: string) => `${a.slice(0, 4)}...${a.slice(-4)}`;
const fmt = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

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

export default function PlatformAnalytics() {
  const reduced = useReducedMotion();

  const summary = useMemo(() => {
    const totalTxs = WW.daily.reduce((s, d) => s + d.txs, 0);
    const activeDays = WW.daily.length;
    const peak = WW.daily.reduce(
      (m, d) => (d.txs > m.txs ? d : m),
      { block_date: "-", txs: 0, traders: 0 },
    );
    const uniqueTraders = WW.traders.filter((t) => t.trader !== TREASURY).length;
    const first = WW.daily[0]?.block_date ?? "-";
    return { totalTxs, activeDays, peak, uniqueTraders, first };
  }, []);

  const leaderboard = useMemo(
    () => WW.traders.filter((t) => t.trader !== TREASURY).slice(0, 15),
    [],
  );

  const dailyData = useMemo(
    () => WW.daily.map((d) => ({ date: d.block_date, txs: d.txs, traders: d.traders })),
    [],
  );

  const flowData = useMemo(
    () =>
      WW.devflow.map((d) => ({
        date: d.block_date,
        inflow: Math.round(d.inflow * 1000) / 1000,
        outflow: -Math.round(d.outflow * 1000) / 1000,
      })),
    [],
  );

  if (WW.daily.length === 0) {
    return (
      <p style={{ ...metaLabel, fontSize: 13 }}>
        Analytics snapshot not generated yet. Run scripts/ww-research.sh and
        regenerate lib/wwData.ts.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "clamp(20px, 4vw, 28px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / on-chain</span>
        </h1>
        <span style={{ ...metaLabel, fontSize: 11 }}>
          program 9TUf...g2fYo - since {summary.first}
        </span>
      </div>

      {/* headline tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <Tile label="PROGRAM TXS">{fmt(summary.totalTxs)}</Tile>
        <Tile label="ACTIVE DAYS">{fmt(summary.activeDays)}</Tile>
        <Tile label="TRADERS (TOP 50)">{fmt(summary.uniqueTraders)}</Tile>
        <Tile label="PEAK DAY">
          {fmt(summary.peak.txs)}
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            {summary.peak.block_date}
          </small>
        </Tile>
        <Tile label="TREASURY NET">
          <span style={{ color: WW.platformStats.treasuryNet >= 0 ? C.good : C.danger }}>
            {fmt(WW.platformStats.treasuryNet, 2)} ◎
          </span>
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            ~the 3.5 floor
          </small>
        </Tile>
        <Tile label="TREASURY IN / OUT">
          <span style={{ fontSize: 16 }}>
            <span style={{ color: C.good }}>{fmt(WW.platformStats.treasuryInflow, 1)}</span>
            {" / "}
            <span style={{ color: C.danger }}>{fmt(WW.platformStats.treasuryOutflow, 1)}</span> ◎
          </span>
        </Tile>
      </div>

      {/* daily activity */}
      <Panel label="DAILY ACTIVITY (TXS)">
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
              <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={40} />
              <Tooltip
                cursor={{ fill: "rgba(255,194,75,0.08)" }}
                contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                labelStyle={{ color: C.dim }}
                formatter={(v: number | string, n) => [fmt(Number(v)), n === "txs" ? "txs" : "traders"]}
              />
              <Bar dataKey="txs" fill={C.accent} fillOpacity={0.8} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* treasury flow */}
      {flowData.length > 0 && (
        <Panel label="TREASURY DAILY FLOW (◎ IN / OUT)">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flowData} stackOffset="sign" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v, 1)} />
                <Tooltip
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string, n) => [`${fmt(Math.abs(Number(v)), 3)} ◎`, n]}
                />
                <Bar dataKey="inflow" stackId="f" fill={C.good} fillOpacity={0.85} isAnimationActive={!reduced} />
                <Bar dataKey="outflow" stackId="f" fill={C.danger} fillOpacity={0.85} isAnimationActive={!reduced} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* top traders */}
      <Panel label="TOP TRADERS BY PROGRAM TXS (TREASURY EXCLUDED)">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
            <thead>
              <tr style={{ color: C.dim, textAlign: "left" }}>
                <th style={th}>#</th>
                <th style={th}>WALLET</th>
                <th style={{ ...th, textAlign: "right" }}>TXS</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((t, i) => {
                const mine = t.trader === ME;
                return (
                  <tr key={t.trader} style={{ borderTop: `1px solid ${C.grid}`, color: mine ? C.accent : C.text }}>
                    <td style={td}>{i + 1}</td>
                    <td style={td} title={t.trader}>
                      {short(t.trader)}
                      {mine ? "  (you)" : ""}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(t.txs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
        Snapshot generated {WW.generatedAt || "(pending)"} from Dune over program
        9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo. Treasury wallet FNj signs
        every battle, so it tops raw tx count and is excluded from the trader
        board. See docs/WAVEWARZ-RESEARCH.md.
      </p>
    </div>
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

const th: React.CSSProperties = { padding: "8px 10px", fontSize: 11, letterSpacing: "0.06em", fontWeight: 400 };
const td: React.CSSProperties = { padding: "9px 10px" };
