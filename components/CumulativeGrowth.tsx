"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS } from "@/lib/battles";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; vol: number };
const battles = battlesRaw as Battle[];

type Mode = "vol" | "battles";

const MONTH_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Point = { label: string; vol: number; battles: number };

function buildCurve(): { data: Point[]; milestones: Record<string, string> } {
  const monthly: Record<string, { vol: number; count: number }> = {};

  for (const b of battles) {
    const m = b.date?.match(/^(\w{3}) (\d{1,2}), (\d{4})$/);
    if (!m) continue;
    const mo = MONTH_IDX[m[1]];
    if (mo === undefined) continue;
    const key = `${m[3]}-${String(mo + 1).padStart(2, "0")}`;
    if (!monthly[key]) monthly[key] = { vol: 0, count: 0 };
    monthly[key].vol += b.vol ?? 0;
    monthly[key].count++;
  }

  const sorted = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));
  let cumVol = 0, cumBattles = 0;
  const milestones: Record<string, string> = {};
  const data: Point[] = [];

  for (const [key, v] of sorted) {
    cumVol += v.vol;
    cumBattles += v.count;
    const [yr, mo] = key.split("-");
    const label = `${MONTH_ABBR[parseInt(mo) - 1]} '${yr.slice(2)}`;
    data.push({ label, vol: Math.round(cumVol * 100) / 100, battles: cumBattles });
    if (!milestones.vol100 && cumVol >= 100) milestones.vol100 = label;
    if (!milestones.vol250 && cumVol >= 250) milestones.vol250 = label;
    if (!milestones.b500 && cumBattles >= 500) milestones.b500 = label;
    if (!milestones.b1000 && cumBattles >= 1000) milestones.b1000 = label;
  }

  return { data, milestones };
}

export default function CumulativeGrowth() {
  const [mode, setMode] = useState<Mode>("vol");
  const { data, milestones } = useMemo(buildCurve, []);

  const last = data[data.length - 1];
  const yKey = mode === "vol" ? "vol" : "battles";

  const refs =
    mode === "vol"
      ? [
          { y: 100, label: "100 ◎" },
          { y: 250, label: "250 ◎" },
        ]
      : [
          { y: 500, label: "500" },
          { y: 1000, label: "1k" },
        ];

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <span style={metaLabel}>CUMULATIVE GROWTH</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            {mode === "vol"
              ? `${last?.vol.toFixed(1)} ◎ cumulative · computed from on-chain battle records`
              : `${last?.battles.toLocaleString()} battles cumulative · sourced from ww-battles.json`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["vol", "battles"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={{
                fontFamily: C.mono,
                fontSize: 11,
                padding: "5px 10px",
                borderRadius: 6,
                cursor: "pointer",
                border: `1px solid ${mode === m ? C.accent : C.grid}`,
                background: mode === m ? C.accent : "transparent",
                color: mode === m ? "#1a1206" : C.dim,
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              {m === "vol" ? "vol ◎" : "# battles"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="cgVolFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.accent} stopOpacity={0.28} />
                <stop offset="95%" stopColor={C.accent} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontFamily: C.mono, fontSize: 10, fill: C.dim }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontFamily: C.mono, fontSize: 10, fill: C.dim }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={(v: number) =>
                mode === "vol" ? `${v}` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              }
            />
            <Tooltip
              contentStyle={{
                background: C.panel,
                border: `1px solid ${C.grid}`,
                fontFamily: C.mono,
                fontSize: 11,
                borderRadius: 8,
              }}
              labelStyle={{ color: C.text, marginBottom: 4 }}
              itemStyle={{ color: C.accent }}
              formatter={(v: number) =>
                mode === "vol"
                  ? [`${v.toFixed(2)} ◎`, "cumulative volume"]
                  : [v.toLocaleString(), "cumulative battles"]
              }
            />
            {refs.map((r) => (
              <ReferenceLine
                key={r.y}
                y={r.y}
                stroke={`${C.dim}88`}
                strokeDasharray="4 3"
                label={{
                  value: r.label,
                  fill: C.dim,
                  fontSize: 10,
                  fontFamily: C.mono,
                  position: "insideTopRight",
                }}
              />
            ))}
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={C.accent}
              fill="url(#cgVolFill)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: C.accent }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Milestone stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginTop: 14 }}>
        {mode === "vol" ? (
          <>
            <Stat label="100 ◎ reached" value={milestones.vol100 ?? "—"} />
            <Stat label="250 ◎ reached" value={milestones.vol250 ?? "—"} />
            <Stat label="TRACKER TOTAL" value={`${last?.vol.toFixed(0)} ◎`} />
            <Stat label="LIVE TOTAL" value={`${BATTLE_STATS.totalVolumeSol.toFixed(0)}+ ◎`} dim />
          </>
        ) : (
          <>
            <Stat label="500TH BATTLE" value={milestones.b500 ?? "—"} />
            <Stat label="1,000TH BATTLE" value={milestones.b1000 ?? "—"} />
            <Stat label="TRACKER TOTAL" value={(last?.battles.toLocaleString() ?? "—") + " battles"} />
            <Stat label="LIVE TOTAL" value={`${BATTLE_STATS.totalShown.toLocaleString()}+ battles`} dim />
          </>
        )}
      </div>

      <p style={{ marginTop: 12, fontFamily: C.mono, fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
        Sourced from ww-battles.json · tracker started May 2025 · live platform totals exceed JSON because pre-launch battles are not captured.
      </p>
    </div>
  );
}

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, letterSpacing: "0.06em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 14, color: dim ? C.dim : C.text, fontWeight: dim ? 400 : 600 }}>
        {value}
      </div>
    </div>
  );
}
