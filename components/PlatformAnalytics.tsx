"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { WW } from "@/lib/wwData";
import { PROGRAM_ID as PROGRAM, TREASURY_WALLET as TREASURY, TRACKED_TRADER_WALLET as ME, FLOOR_SOL } from "@/lib/config";
import { BATTLE_STATS as S } from "@/lib/battles";
import { DATA_AS_OF } from "@/lib/freshness";

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

interface ActivityDay {
  date: string;
  buys: number;
  sells: number;
  battles: number;
  settled: number;
  claims: number;
  mints: number;
}
interface VolRow {
  trader: string;
  sol: number;
  buys: number;
}
interface VolBoard {
  meta: { window_days: number; as_of: string; note: string };
  rows: VolRow[];
}

export default function PlatformAnalytics() {
  const reduced = useReducedMotion();
  const [activity, setActivity] = useState<ActivityDay[] | null>(null);
  const [volboard, setVolboard] = useState<VolBoard | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ww-activity.json")
      .then((r) => r.json())
      .then((d: ActivityDay[]) => alive && setActivity([...d].reverse().slice(-30)))
      .catch(() => {});
    fetch("/ww-volboard.json")
      .then((r) => r.json())
      .then((d: VolBoard) => alive && setVolboard(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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

      <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim }}>
        For live per-battle browsing and leaderboards, see WaveWarZ's own{" "}
        <a href="https://wavewarz-intelligence.vercel.app" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
          Intelligence dashboard ↗
        </a>
        . What's below is this tracker's own angle: trend charts and flow that dashboard doesn't show.
      </p>

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
            ~the {FLOOR_SOL} floor
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

      {/* LIVE - last 30 days, fetched fresh from Dune */}
      {activity && activity.length > 0 && (
        <Panel label={`LIVE - DAILY ACTIVITY, LAST 30 DAYS (battles / buys / sells / claims)`}>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={36} />
                <YAxis yAxisId="l" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={32} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: C.good, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={24} />
                <Tooltip
                  cursor={{ fill: "rgba(255,194,75,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string, n) => [fmt(Number(v)), n]}
                />
                <Bar yAxisId="l" dataKey="buys" stackId="t" fill={C.accent} fillOpacity={0.85} isAnimationActive={!reduced} />
                <Bar yAxisId="l" dataKey="sells" stackId="t" fill={C.danger} fillOpacity={0.7} isAnimationActive={!reduced} />
                <Bar yAxisId="l" dataKey="claims" stackId="t" fill={C.dim} fillOpacity={0.6} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="battles" stroke={C.good} strokeWidth={1.6} dot={false} isAnimationActive={!reduced} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            Bars = trades (buys gold, sells red, claims grey, stacked); line = battles
            opened. Decoded from program 9TUf instruction calls, refreshed from Dune.
          </p>
        </Panel>
      )}

      {volboard && volboard.rows.length > 0 && (
        <Panel label={`LIVE - TOP BUYERS BY SOL VOLUME, LAST ${volboard.meta.window_days} DAYS`}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.dim, textAlign: "left" }}>
                  <th style={th}>#</th>
                  <th style={th}>WALLET</th>
                  <th style={{ ...th, textAlign: "right" }}>VOLUME ◎</th>
                  <th style={{ ...th, textAlign: "right" }}>BUYS</th>
                </tr>
              </thead>
              <tbody>
                {volboard.rows
                  .filter((t) => t.trader !== TREASURY)
                  .slice(0, 15)
                  .map((t, i) => {
                    const mine = t.trader === ME;
                    return (
                      <tr key={t.trader} style={{ borderTop: `1px solid ${C.grid}`, color: mine ? C.accent : C.text }}>
                        <td style={td}>{i + 1}</td>
                        <td style={td} title={t.trader}>{short(t.trader)}{mine ? "  (you)" : ""}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(t.sol, 2)}</td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(t.buys)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            Buy-side SOL committed per wallet over the last {volboard.meta.window_days} days
            (as of {volboard.meta.as_of}). FNj (platform ops) excluded. Live from Dune.
          </p>
        </Panel>
      )}

      {/* what the data says */}
      <Panel label="WHAT THE DATA SAYS">
        <ul style={{ margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 14 }}>
          <li>
            Treasury nets <b>{fmt(WW.platformStats.treasuryNet, 2)} ◎</b> lifetime -
            landing on the ~{FLOOR_SOL} SOL floor, so the skim discipline holds on-chain.
          </li>
          <li>
            <b>{fmt(Math.round((WW.program.battlesSettled / Math.max(1, WW.program.battlesCreated)) * 1000) / 10)}%</b>{" "}
            of battles settle - the program resolves what it starts.
          </li>
          <li>
            <b>{fmt(WW.program.uniqueTraders)} traders</b> moved{" "}
            <b>{fmt(WW.volume.total)} ◎</b> of buy volume across{" "}
            {fmt(WW.program.buys + WW.program.sells)} trades.
          </li>
          <li>
            Trading is hard: the tracked wallet is a net loser at{" "}
            <b>{fmt(WW.traderStats.winRate, 1)}% win rate</b> - claims rarely
            outrun bets.
          </li>
        </ul>
      </Panel>

      {/* daily activity */}
      <Panel label="DAILY ACTIVITY - TXS (BARS) vs UNIQUE TRADERS (LINE)">
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
              <YAxis yAxisId="l" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={40} />
              <YAxis yAxisId="r" orientation="right" tick={{ fill: C.good, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={28} />
              <Tooltip
                cursor={{ fill: "rgba(255,194,75,0.08)" }}
                contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                labelStyle={{ color: C.dim }}
                formatter={(v: number | string, n) => [fmt(Number(v)), n === "txs" ? "txs" : "traders"]}
              />
              <Bar yAxisId="l" dataKey="txs" fill={C.accent} fillOpacity={0.8} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
              <Line yAxisId="r" type="monotone" dataKey="traders" stroke={C.good} strokeWidth={1.5} dot={false} isAnimationActive={!reduced} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* battles vs trades over time */}
      {WW.timeline.length > 0 && (
        <Panel label="BATTLES (LINE) vs TRADES (BARS) PER DAY">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={WW.timeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block_date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: "rgba(255,194,75,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string, n) => [fmt(Number(v)), n]}
                />
                <Bar dataKey="trades" fill={C.accent} fillOpacity={0.7} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="battles" stroke={C.good} strokeWidth={1.5} dot={false} isAnimationActive={!reduced} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

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

      {/* platform buy volume */}
      {WW.volume.series.length > 0 && (
        <Panel label={`PLATFORM BUY VOLUME - ${fmt(WW.volume.total, 1)} ◎ COMMITTED`}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WW.volume.series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block_date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v, 1)} />
                <Tooltip
                  cursor={{ fill: "rgba(255,194,75,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string) => [`${fmt(Number(v), 2)} ◎`, "buy volume"]}
                />
                <Bar dataKey="vol" fill={C.accent} fillOpacity={0.8} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            SOL committed by traders on buyShares txs (includes the ~1.5% fees + gas).
          </p>
        </Panel>
      )}

      <Panel label="HOW THESE COMPARE TO OTHER TABS">
        <ul style={{ margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 13 }}>
          <li><b>Battles</b>: {fmt(WW.program.battlesCreated)} here = on-chain <i>initializeBattle</i> calls; the Battles tab&apos;s {S.totalShown.toLocaleString()} is the site&apos;s battle count (it groups multi-song main events and excludes test battles).</li>
          <li><b>Traders</b>: {fmt(WW.program.uniqueTraders)} here = unique <i>buyShares</i> signers on-chain; the Traders tab shows the site&apos;s top 101 leaderboard.</li>
          <li><b>Volume</b>: {fmt(WW.volume.total, 0)} ◎ here is buy-side only (SOL committed on buys); the site reports ~{S.totalVolumeSol.toFixed(0)} ◎ counting both buy and sell sides.</li>
          <li><b>Claims</b>: {fmt(WW.program.claims)} <i>claimShares</i> instruction calls on-chain (Dune); the site reports {S.withdrawalCount} withdrawals totaling {S.traderClaimsSol.toFixed(2)} ◎ — different counting methodology, same underlying action.</li>
        </ul>
        <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>Different measures, all from-chain - not contradictions.</p>
      </Panel>

      <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
        On-chain snapshot {WW.generatedAt || "(pending)"} from Dune over program
        {PROGRAM} (a bit older than the {DATA_AS_OF}{" "}
        site snapshots). Treasury wallet FNj signs every battle, so it tops raw tx
        count and is excluded from the trader board. See docs/WAVEWARZ-RESEARCH.md.
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
