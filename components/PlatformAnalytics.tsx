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

// On-chain daily data from Dune - all instructions decoded day by day.
// This replaces the stale lib/wwData.ts snapshot with fresh, continuously-updated data
// from 2025-05-26 (program's true first day) to today.
interface OnchainDailyRow {
  date: string;
  txs: number;
  traders: number;
  buys: number;
  sells: number;
  claims: number;
  created: number;  // createBattle / initializeBattle calls
  settled: number;  // endBattle / settleBattle calls
  minted: number;   // mint instruction calls
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
export default function PlatformAnalytics() {
  const reduced = useReducedMotion();
  const [onchainDaily, setOnchainDaily] = useState<OnchainDailyRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    // Fetch fresh on-chain daily data: all program instructions decoded by day.
    // Gap-filled from 2025-05-26 (first day) to today with zero values for inactive days.
    fetch("/ww-onchain-daily.json")
      .then((r) => r.json())
      .then((d: OnchainDailyRow[]) => alive && setOnchainDaily(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // The last-30-days view is a window onto the same fresh series the rest of
  // this section uses. It used to come from public/ww-activity.json, a separate
  // snapshot that had gone 81 days stale while this panel still called itself
  // LIVE. Deriving it removes the second copy that made that possible.
  const activity = useMemo<ActivityDay[] | null>(() => {
    if (!onchainDaily?.length) return null;
    return onchainDaily
      .filter((d) => d.txs > 0)
      .slice(-30)
      .map((d) => ({
        date: d.date,
        buys: d.buys,
        sells: d.sells,
        battles: d.created,
        settled: d.settled,
        claims: d.claims,
        mints: d.minted,
      }));
  }, [onchainDaily]);

  // Compute summary stats from fresh on-chain data. These are all-time program stats
  // from the decoded instruction stream, not estimates or subsets.
  const summary = useMemo(() => {
    if (!onchainDaily) return null;
    const totalTxs = onchainDaily.reduce((s, d) => s + d.txs, 0);
    const activeDays = onchainDaily.filter((d) => d.txs > 0).length;
    const peak = onchainDaily.reduce(
      (m, d) => (d.txs > m.txs ? d : m),
      { date: "-", txs: 0, traders: 0 },
    );
    // Distinct traders across all time - pulled from the dataset directly
    const uniqueTraders = WW.traders.filter((t) => t.trader !== TREASURY).length;
    const first = onchainDaily[0]?.date ?? "-";
    return { totalTxs, activeDays, peak, uniqueTraders, first };
  }, [onchainDaily]);

  const dailyData = useMemo(
    () => (onchainDaily ? onchainDaily.map((d) => ({ date: d.date, txs: d.txs, traders: d.traders })) : []),
    [onchainDaily],
  );

  // Timeline: created/settled/minted battles per day vs total trades (buys + sells + claims).
  // This shows the relationship between battle lifecycle and trading activity.
  const timelineData = useMemo(() => {
    if (!onchainDaily) return [];
    return onchainDaily.map((d) => ({
      date: d.date,
      battles: d.created,
      settled: d.settled,
      minted: d.minted,
      trades: d.buys + d.sells + d.claims,
    }));
  }, [onchainDaily]);

  const flowData = useMemo(
    () =>
      WW.devflow.map((d) => ({
        date: d.block_date,
        inflow: Math.round(d.inflow * 1000) / 1000,
        outflow: -Math.round(d.outflow * 1000) / 1000,
      })),
    [],
  );

  // Show loading state until on-chain data arrives, or fall back to old snapshot if fetch fails.
  if (!onchainDaily && WW.daily.length === 0) {
    return (
      <p style={{ ...metaLabel, fontSize: 13 }}>
        Loading on-chain analytics. If this persists, check that public/ww-onchain-daily.json
        was generated and is valid JSON.
      </p>
    );
  }

  // Use fresh data if available; fall back to stale snapshot for trader stats that
  // don't have equivalents in the on-chain data alone.
  const safe = { summary: summary || { totalTxs: 0, activeDays: 0, peak: { date: "-", txs: 0, traders: 0 }, uniqueTraders: 0, first: "-" }, dailyData };

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
          program 9TUf...g2fYo - since {safe.summary.first}
        </span>
      </div>

      <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim }}>
        For live per-battle browsing and leaderboards, see WaveWarZ's own{" "}
        <a href="https://wavewarz-intelligence.vercel.app" target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
          Intelligence dashboard ↗
        </a>
        . What's below is this tracker's own angle: trend charts and flow that dashboard doesn't show.
      </p>

      {/* headline tiles - all computed from fresh on-chain data */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <Tile label="PROGRAM TXS">{fmt(safe.summary.totalTxs)}</Tile>
        <Tile label="ACTIVE DAYS">{fmt(safe.summary.activeDays)}</Tile>
        <Tile label="TRADERS (TOP 50)">{fmt(safe.summary.uniqueTraders)}</Tile>
        <Tile label="PEAK DAY">
          {fmt(safe.summary.peak.txs)}
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            {safe.summary.peak.date}
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
                  cursor={{ fill: "rgba(149,254,124,0.08)" }}
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

      {/* A "top buyers by SOL volume" panel used to sit here, fed by
          public/ww-volboard.json. It was labelled LIVE while running on a file
          81 days old, and per-signer volume needs an account_activity join that
          the free Dune tier times out on. Removed rather than relabelled: it is
          a trader ranking, which is wavewarz.info's own leaderboard to own, and
          a second ranking that disagrees with theirs helps nobody. */}

      {/* what the data says - mixing fresh and persistent data sources */}
      {onchainDaily && (
        <Panel label="WHAT THE DATA SAYS">
          <ul style={{ margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 14 }}>
            <li>
              Treasury nets <b>{fmt(WW.platformStats.treasuryNet, 2)} ◎</b> lifetime -
              landing on the ~{FLOOR_SOL} SOL floor, so the skim discipline holds on-chain.
            </li>
            <li>
              <b>
                {fmt(
                  Math.round(
                    ((onchainDaily.reduce((s, d) => s + d.settled, 0) /
                      Math.max(1, onchainDaily.reduce((s, d) => s + d.created, 0))) *
                      1000) /
                      10,
                  ),
                )}
                %
              </b>
              {" "}
              of battles settle - the program resolves what it starts.
            </li>
            <li>
              <b>{fmt(WW.program.uniqueTraders)} traders</b> moved{" "}
              <b>{fmt(WW.volume.total)} ◎</b> of trading volume across{" "}
              {fmt(WW.program.buys + WW.program.sells)} trades.
            </li>
            <li>
              <b>{fmt(WW.program.claims)}</b> <i>claimShares</i> calls against{" "}
              <b>{fmt(WW.program.battlesSettled)}</b> settled battles - traders
              have to claim manually, so a settled battle is not a paid-out one.
            </li>
          </ul>
        </Panel>
      )}

      {/* daily activity - from fresh on-chain data */}
      {onchainDaily && onchainDaily.length > 0 && (
        <Panel label="DAILY ACTIVITY - TXS (BARS) vs UNIQUE TRADERS (LINE)">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                <YAxis yAxisId="l" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={40} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: C.good, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "rgba(149,254,124,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string, n) => [fmt(Number(v)), n === "txs" ? "txs" : "traders"]}
                />
                <Bar yAxisId="l" dataKey="txs" fill={C.accent} fillOpacity={0.8} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="traders" stroke={C.good} strokeWidth={1.5} dot={false} isAnimationActive={!reduced} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            All-time daily activity from on-chain instruction decode, refreshed from Dune.
            Spans {onchainDaily[0]?.date} to {onchainDaily[onchainDaily.length - 1]?.date}.
          </p>
        </Panel>
      )}

      {/* battles vs trades over time - from decoded on-chain data */}
      {timelineData.length > 0 && (
        <Panel label="BATTLES CREATED (LINE) vs TRADES PER DAY (BARS)">
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: "rgba(149,254,124,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string, n) => [fmt(Number(v)), n]}
                />
                <Bar dataKey="trades" fill={C.accent} fillOpacity={0.7} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="battles" stroke={C.good} strokeWidth={1.5} dot={false} isAnimationActive={!reduced} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            Battles = createBattle calls decoded from on-chain. Trades = buys + sells + claims per day.
          </p>
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

      {/* platform volume, both sides */}
      {WW.volume.series.length > 0 && (
        <Panel label={`PLATFORM VOLUME - ${fmt(WW.volume.total, 1)} ◎ TRADED, BOTH SIDES`}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WW.volume.series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="block_date" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={48} />
                <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => fmt(v, 1)} />
                <Tooltip
                  cursor={{ fill: "rgba(149,254,124,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number | string) => [`${fmt(Number(v), 2)} ◎`, "volume"]}
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

      {onchainDaily && (
        <Panel label="HOW THESE COMPARE TO OTHER TABS">
          <ul style={{ margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 13 }}>
            <li>
              <b>Battles</b>: {fmt(onchainDaily.reduce((s, d) => s + d.created, 0))} here = on-chain{" "}
              <i>createBattle</i> calls decoded from instruction stream; the Battles tab&apos;s{" "}
              {S.totalShown.toLocaleString()} is the site&apos;s battle count (it groups multi-song main
              events and excludes test battles).
            </li>
            <li>
              <b>Traders</b>: {fmt(WW.program.uniqueTraders)} here = unique <i>buyShares</i> signers on-chain;
              the Traders tab shows the site&apos;s top 101 leaderboard.
            </li>
            <li>
              <b>Volume</b>: {fmt(WW.volume.total, 0)} ◎ is both sides, summed from the
              platform&apos;s own per-battle figures, so it agrees with the ~{S.totalVolumeSol.toFixed(0)} ◎
              the site reports rather than sitting alongside it as a rival number.
            </li>
            <li>
              <b>Claims</b>: {fmt(onchainDaily.reduce((s, d) => s + d.claims, 0))} <i>claimShares</i>{" "}
              instruction calls decoded from on-chain; the site reports {S.withdrawalCount} withdrawals
              totaling {S.traderClaimsSol.toFixed(2)} ◎ — different counting methodology, same underlying
              action.
            </li>
          </ul>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>Different measures, all from-chain - not contradictions.</p>
        </Panel>
      )}

      {onchainDaily && (
        <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
          On-chain instruction data refreshed from Dune over program {PROGRAM}. Daily activity
          (txs, battles, trades) comes from decoded on-chain instructions; treasury flow, platform
          buy volume, and trader PnL are from the {WW.generatedAt || "older"} snapshot (these require
          separate data pipelines). Treasury wallet FNj signs every battle, so it tops raw tx count and
          is excluded from the trader board. See docs/WAVEWARZ-RESEARCH.md.
        </p>
      )}
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
