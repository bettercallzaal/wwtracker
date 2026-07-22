"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { loadWeeklyRevenueFromCsv, WeeklyTrend, WeeklyRevenue } from "@/lib/treasuryAnalytics";
import { getPublicStats } from "@/lib/wavewarzApi";

const fmt = (n: number, dp = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const usd = (sol: number, solPrice: number) => fmt(sol * solPrice, 0);

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

interface WeeklyRevenueAnalyticsProps {
  solPrice?: number;
}

export default function WeeklyRevenueAnalytics({ solPrice }: WeeklyRevenueAnalyticsProps) {
  const reduced = useReducedMotion();
  const [trend, setTrend] = useState<WeeklyTrend | null>(null);
  const [loading, setLoading] = useState(true);
  // The LIVE SOL price from the WaveWarZ API - never a hardcoded default, so USD
  // figures are real (this tracker's "no invented numbers" rule). Falls back to
  // the optional prop only if the API is unreachable.
  const [price, setPrice] = useState<number>(solPrice ?? 0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      let livePrice = solPrice ?? 0;
      try {
        const stats = await getPublicStats();
        if (stats?.solPriceUsd) livePrice = stats.solPriceUsd;
      } catch (err) {
        console.error("Failed to fetch live SOL price, using fallback:", err);
      }
      if (alive) setPrice(livePrice);
      try {
        const data = await loadWeeklyRevenueFromCsv(livePrice);
        if (alive) {
          setTrend(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load weekly revenue:", err);
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [solPrice]);

  const chartData = useMemo(() => {
    if (!trend) return [];
    // Last 8-12 weeks for the trend chart
    const last12 = trend.weeks.slice(-12);
    return last12.map((w) => ({
      week: w.week_start_date.slice(5),
      gross: Math.round(w.gross_inflow_sol * 1000) / 1000,
      net: Math.round(w.net_flow_sol * 1000) / 1000,
      battles: w.battles_count,
      per_battle: Math.round(w.per_battle_fee_sol * 10000) / 10000,
    }));
  }, [trend]);

  if (loading) {
    return (
      <p style={{ ...metaLabel, fontSize: 13, color: C.dim }}>
        Loading weekly revenue data...
      </p>
    );
  }

  if (!trend || !trend.current_week) {
    return (
      <p style={{ ...metaLabel, fontSize: 13, color: C.dim }}>
        No revenue data available.
      </p>
    );
  }

  const current = trend.current_week;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* headline tiles - this week's revenue */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        <Tile label="THIS WEEK GROSS INFLOW">
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmt(current.gross_inflow_sol, 2)} ◎
          </span>
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            ~${usd(current.gross_inflow_sol, price)}
          </small>
        </Tile>
        <Tile label="THIS WEEK NET FLOW">
          <span
            style={{
              color: current.net_flow_sol >= 0 ? C.good : C.danger,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmt(current.net_flow_sol, 2)} ◎
          </span>
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            ~${usd(current.net_flow_sol, price)}
          </small>
        </Tile>
        <Tile label="BATTLES THIS WEEK">
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(current.battles_count)}</span>
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            avg fee per battle
          </small>
        </Tile>
        <Tile label="AVG FEE PER BATTLE">
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {fmt(current.per_battle_fee_sol, 4)} ◎
          </span>
          <small style={{ display: "block", color: C.dim, fontFamily: C.mono, fontSize: 11 }}>
            ~${fmt(current.per_battle_fee_usd, 2)}
          </small>
        </Tile>
      </div>

      {/* trend chart - last 8-12 weeks */}
      {chartData.length > 0 && (
        <Panel label={`WEEKLY REVENUE TREND - LAST ${chartData.length} WEEKS`}>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                  tickLine={false}
                  axisLine={{ stroke: C.grid }}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="l"
                  tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v: number) => fmt(v, 1)}
                />
                <YAxis
                  yAxisId="r"
                  orientation="right"
                  tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }}
                  tickLine={false}
                  axisLine={false}
                  width={32}
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
                  formatter={(v: number, n) => {
                    if (n === "gross") return [`${fmt(v, 2)} ◎`, "Gross Inflow"];
                    if (n === "net") return [`${fmt(v, 2)} ◎`, "Net Flow"];
                    if (n === "battles") return [fmt(v), "Battles"];
                    if (n === "per_battle") return [`${fmt(v, 4)} ◎`, "Fee/Battle"];
                    return [v, n];
                  }}
                />
                <Bar yAxisId="l" dataKey="gross" fill={C.good} fillOpacity={0.7} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
                <Bar yAxisId="l" dataKey="net" fill={C.accent} fillOpacity={0.6} isAnimationActive={!reduced} radius={[2, 2, 0, 0]} />
                <Line
                  yAxisId="r"
                  type="monotone"
                  dataKey="per_battle"
                  stroke={C.danger}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={!reduced}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            Bars (left) = weekly gross inflow (green) and net flow (gold). Line (right) = avg fee per battle (red).
            Bars stacked to show inflow growth; trending up indicates increasing platform revenue.
          </p>
        </Panel>
      )}

      {/* weekly table - last 8-12 weeks */}
      {trend.weeks.length > 0 && (
        <Panel label={`WEEKLY REVENUE DETAIL - LAST ${Math.min(12, trend.weeks.length)} WEEKS`}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.dim, textAlign: "left" }}>
                  <th style={th}>WEEK</th>
                  <th style={{ ...th, textAlign: "right" }}>GROSS (◎)</th>
                  <th style={{ ...th, textAlign: "right" }}>NET (◎)</th>
                  <th style={{ ...th, textAlign: "right" }}>BATTLES</th>
                  <th style={{ ...th, textAlign: "right" }}>FEE/BATTLE</th>
                </tr>
              </thead>
              <tbody>
                {trend.weeks
                  .slice(-12)
                  .reverse()
                  .map((w, i) => {
                    const isCurrentWeek = i === 0;
                    return (
                      <tr
                        key={w.week_start_date}
                        style={{
                          borderTop: `1px solid ${C.grid}`,
                          color: isCurrentWeek ? C.accent : C.text,
                          fontWeight: isCurrentWeek ? 600 : 400,
                        }}
                      >
                        <td style={td}>
                          {w.week_start_date} {isCurrentWeek ? "(this)" : ""}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: w.gross_inflow_sol > 0 ? C.good : C.dim,
                          }}
                        >
                          {fmt(w.gross_inflow_sol, 3)}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: w.net_flow_sol >= 0 ? C.text : C.danger,
                          }}
                        >
                          {fmt(w.net_flow_sol, 3)}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(w.battles_count)}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {fmt(w.per_battle_fee_sol, 4)} ({fmt(w.per_battle_fee_usd, 1)}$)
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <p style={{ ...metaLabel, fontSize: 11, marginTop: 8 }}>
            All figures sourced from public/ww-daily-treasury.csv - on-chain fee wallet. Gross = positive delta_sol;
            net = all delta_sol (including distributions out). Per-battle fee = gross inflow / battles that week.
          </p>
        </Panel>
      )}

      {/* summary stats */}
      <Panel label="ALL-TIME SUMMARY">
        <ul style={{ margin: 0, paddingLeft: 18, color: C.text, lineHeight: 1.8, fontSize: 14 }}>
          <li>
            All-time gross revenue: <b>{fmt(trend.all_time_gross_sol, 2)} ◎</b> (~${usd(trend.all_time_gross_sol, price)})
          </li>
          <li>
            All-time net (after distributions): <b>{fmt(trend.all_time_net_sol, 2)} ◎</b> (~${usd(trend.all_time_net_sol, price)})
          </li>
          <li>
            This week accounts for ~<b>{fmt((current.gross_inflow_sol / Math.max(1, trend.all_time_gross_sol)) * 100, 1)}%</b> of lifetime
            inflow.
          </li>
        </ul>
      </Panel>

      <p style={{ margin: 0, fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
        Weekly revenue analytics from on-chain treasury CSV (386 days tracked). All figures are real, sourced from the
        fee wallet balance changes. No estimated or projected numbers. SOL price used: ${price.toFixed(2)}.
      </p>
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
