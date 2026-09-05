"use client";

// WaveWarZ fee model - shows where every SOL goes on the platform.
//
// Displays the per-trade fee split (1.0% artist vs 0.5% platform), the
// settlement waterfall applied to losing pools, the skip-queue auction ladder,
// and lifetime platform revenue calculated from real on-chain volume.
//
// The settlement and skip-queue sections show the SCHEDULE applied to
// hypothetical inputs, not measured on-chain flows - this is a model of
// how the system is designed to work, not a snapshot of what has actually
// been distributed. Settlement flows are not yet measured on-chain.

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";
import {
  tradeFeeSplit,
  settlementSplit,
  skipLadder,
  platformRevenue,
  FEE_SCHEDULE,
} from "@/lib/feeModel";
import type { PublicStats } from "@/lib/wavewarzApi";
import type { CacheStatus } from "@/lib/wwCache";

// Format numbers for display - avoid rendering 0 when unknown, show TBD instead.
const fmt = (n: number | null, dp = 2) => {
  if (n === null || n === undefined) return "TBD";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
};

interface Loaded {
  status: CacheStatus;
  ageSeconds: number | null;
  stats: PublicStats | null;
}

export default function FeeModel() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch platform stats on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ww/stats", { cache: "no-store" });
        const payload = await res.json();
        if (cancelled) return;
        setLoaded({
          status: payload?.status ?? "unknown",
          ageSeconds: payload?.ageSeconds ?? null,
          stats: payload?.data ?? null,
        });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Prepare visualization data for per-trade split (1% artist, 0.5% platform).
  const tradeData = useMemo(
    () => [
      {
        label: "Per-Trade Fee Split (1.5%)",
        artist: FEE_SCHEDULE.ARTIST_TRADE_FEE * 100,
        platform: FEE_SCHEDULE.PLATFORM_TRADE_FEE * 100,
      },
    ],
    [],
  );

  // Prepare visualization data for settlement split (50/40/5/2/3).
  const settlementData = useMemo(
    () => [
      {
        label: "Settlement Waterfall (100 SOL losing pool)",
        losingTraders: FEE_SCHEDULE.SETTLEMENT_LOSING_TRADERS * 100,
        winningTraders: FEE_SCHEDULE.SETTLEMENT_WINNING_TRADERS * 100,
        winningArtist: FEE_SCHEDULE.SETTLEMENT_WINNING_ARTIST * 100,
        losingArtist: FEE_SCHEDULE.SETTLEMENT_LOSING_ARTIST * 100,
        platform: FEE_SCHEDULE.SETTLEMENT_PLATFORM * 100,
      },
    ],
    [],
  );

  // Prepare skip-queue ladder data (first 10 prices).
  const skipData = useMemo(() => {
    const prices = skipLadder(10);
    return prices.map((price, i) => ({
      position: i + 1,
      price: price,
    }));
  }, []);

  // Calculate lifetime revenue from real platform stats.
  const lifetimeBreakdown = useMemo(() => {
    if (!loaded?.stats) return null;
    const volumeSol = loaded.stats.volume?.totalSol ?? 0;
    // Note: settlement and skip fees are not yet tracked on-chain,
    // so we show zero for those in the realistic calculation.
    return platformRevenue({
      volumeSol,
      losingPoolSol: 0,
      quickBattles: loaded.stats.battles?.quickBattles ?? 0,
      communityBattles: loaded.stats.battles?.communityBattles ?? 0,
      skipFeesSol: 0,
    });
  }, [loaded?.stats]);

  // Trade fee split for real volume.
  const lifetimeTradeFeeSplit = useMemo(() => {
    if (!loaded?.stats) return null;
    const volumeSol = loaded.stats.volume?.totalSol ?? 0;
    return tradeFeeSplit(volumeSol);
  }, [loaded?.stats]);

  // Freshness message (same pattern as Leaderboard).
  const freshness = (() => {
    if (error) return `live stats could not load: ${error}`;
    if (!loaded) return "loading live platform stats...";
    if (loaded.status === "live") return "live from wavewarz.info via the cached tracker API.";
    if (loaded.status === "stale") {
      const mins = loaded.ageSeconds != null ? Math.round(loaded.ageSeconds / 60) : null;
      return `live source unreachable - showing last good data${mins != null ? ` from ~${mins} min ago` : ""}.`;
    }
    return "live stats are currently unavailable.";
  })();

  const unavailable = !error && loaded?.status === "unknown";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 34px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / fee model</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Every SOL on WaveWarZ is accounted for. Below is the platform's authoritative fee schedule
          and where revenue flows. Artists receive 1% of volume automatically on every trade - twice what
          the platform takes. Settlement bonuses are split among winners, losers, and both artists.
        </p>
      </header>

      {/* Per-trade fee split: 1% artist, 0.5% platform. */}
      <Panel label="PER-TRADE FEE SPLIT">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tradeData}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} />
                <YAxis
                  label={{ value: "% of volume", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 11 }}
                  tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number) => `${v.toFixed(2)}%`}
                />
                <Legend wrapperStyle={{ paddingTop: 12, fontFamily: C.mono, fontSize: 12 }} />
                <Bar dataKey="artist" name="Artist (1.0%)" fill={C.accent} />
                <Bar dataKey="platform" name="Platform (0.5%)" fill={C.accentDim} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
            On every trade, 1.5% total is deducted: 1.0% goes to the artist automatically
            (on-chain, whether or not they are present), and 0.5% to the platform. The artist
            receives 2x what the platform keeps, across the entire lifetime of WaveWarZ.
          </p>
        </div>
      </Panel>

      {/* Settlement waterfall: how the losing pool is split. */}
      <Panel label="SETTLEMENT SPLIT - LOSING POOL WATERFALL">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={settlementData}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: C.dim, fontSize: 10, fontFamily: C.mono }}
                  tickLine={false}
                  width={80}
                />
                <YAxis
                  label={{ value: "% of losing pool", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 11 }}
                  tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 11 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                />
                <Legend wrapperStyle={{ paddingTop: 12, fontFamily: C.mono, fontSize: 11 }} />
                <Bar dataKey="losingTraders" name="Losing Traders (50%)" fill={C.good} stackId="settlement" />
                <Bar dataKey="winningTraders" name="Winning Traders (40%)" fill={C.accent} stackId="settlement" />
                <Bar dataKey="winningArtist" name="Winning Artist (5%)" fill="#7c8cff" stackId="settlement" />
                <Bar dataKey="losingArtist" name="Losing Artist (2%)" fill="#d366ff" stackId="settlement" />
                <Bar dataKey="platform" name="Platform (3%)" fill={C.accentDim} stackId="settlement" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
            When a battle concludes, the losing pool is redistributed: 50% refunded to losing traders,
            40% to winning traders, and 5% to the winning artist as a bonus. The losing artist receives
            2% (consolation from their own pool), and 3% goes to the platform. This schedule is part of
            the WaveWarZ design; measured settlement flows are not yet tracked on-chain but will follow
            these proportions.
          </p>
        </div>
      </Panel>

      {/* Skip-queue auction ladder. */}
      <Panel label="SKIP-QUEUE AUCTION LADDER">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={skipData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="position"
                  label={{ value: "Skip Position", fill: C.dim, fontSize: 11, offset: 4 }}
                  tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                  tickLine={false}
                  axisLine={{ stroke: C.grid }}
                />
                <YAxis
                  label={{ value: "Cost (SOL)", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 11 }}
                  tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,194,75,0.08)" }}
                  contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }}
                  labelStyle={{ color: C.dim }}
                  formatter={(v: number) => `${v.toFixed(3)} ◎`}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={C.accent}
                  dot={{ fill: C.accent, r: 4 }}
                  activeDot={{ r: 6 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
            The skip-queue auction escalates: the first skip costs 0.02 SOL, the second 0.03 SOL,
            the third 0.04 SOL, and so on (+0.01 SOL per skip). All skip-queue revenue goes to the
            platform. This is a novel mechanic that incentivizes participation without penalizing
            early adopters.
          </p>
        </div>
      </Panel>

      {/* Lifetime revenue breakdown from real stats. */}
      {unavailable ? (
        <Panel label="LIFETIME PLATFORM REVENUE">
          <p style={{ ...metaLabel, fontSize: 13, color: C.text }}>
            Live stats are unavailable right now.
          </p>
          <p style={{ ...metaLabel, fontSize: 12, marginTop: 6 }}>
            This reads live from wavewarz.info and will return when the source is reachable.
          </p>
        </Panel>
      ) : (
        <Panel label="LIFETIME PLATFORM REVENUE">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loaded?.stats && lifetimeBreakdown ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  <RevenueTile label="TOTAL VOLUME" value={`${fmt(loaded.stats.volume.totalSol, 1)} ◎`} />
                  <RevenueTile label="FROM TRADES" value={`${fmt(lifetimeBreakdown.tradeFeeSol, 3)} ◎`} />
                  <RevenueTile label="QUICK BATTLES" value={`${fmt(lifetimeBreakdown.quickBattleLaunchFeesSol, 3)} ◎`} />
                  <RevenueTile label="COMMUNITY" value={`${fmt(lifetimeBreakdown.communityBattleLaunchFeesSol, 3)} ◎`} />
                </div>

                <div style={{ paddingTop: 8, borderTop: `1px solid ${C.grid}` }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ ...metaLabel, fontSize: 12 }}>TOTAL PLATFORM REVENUE</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: C.accent, fontVariantNumeric: "tabular-nums" }}>
                      {fmt(lifetimeBreakdown.totalSol, 3)} ◎
                    </span>
                  </div>
                </div>

                {lifetimeTradeFeeSplit && (
                  <div style={{ paddingTop: 12, borderTop: `1px solid ${C.grid}` }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <span style={metaLabel}>ARTIST EARNINGS FROM TRADES</span>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: C.text, fontSize: 13 }}>Total earned by artists (1% of volume)</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: C.good, fontVariantNumeric: "tabular-nums" }}>
                          {fmt(lifetimeTradeFeeSplit.artistSol, 3)} ◎
                        </span>
                      </div>
                      <p style={{ ...metaLabel, fontSize: 10, lineHeight: 1.5, marginTop: 4 }}>
                        Artists have earned {fmt(lifetimeTradeFeeSplit.artistSol, 1)} SOL in automatic
                        trade fees across the platform's lifetime - not counting settlement bonuses, which are
                        paid from the losing pool and not yet tracked on-chain.
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ ...metaLabel, fontSize: 12, color: C.dim }}>loading revenue breakdown...</p>
            )}
          </div>
        </Panel>
      )}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        {freshness} The fee schedule above is the WaveWarZ reference specification
        (from CandyToyBox/wavewarz-intelligence). Settlement flows are modeled here based on the
        design schedule but not yet measured on-chain; skip-queue fees and launch fees are
        platform revenue and not yet separated in live stats. Trade fees and artist earnings
        are computed from actual on-chain volume.
      </p>
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

function RevenueTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.elev, border: `1px solid ${C.grid}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 9 }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: C.accent }}>{value}</span>
    </div>
  );
}
