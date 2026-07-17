"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";
import { BATTLE_STATS } from "@/lib/battles";

type BattleRow = { date?: string; vol?: number };
const battles = battlesRaw as BattleRow[];

const TAKE_RATE = BATTLE_STATS.platformRevenueSol / BATTLE_STATS.totalVolumeSol;

const MONTH_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Point = { label: string; rev: number };

function buildCurve(): { data: Point[]; peak: Point } {
  const monthly: Record<string, number> = {};

  for (const b of battles) {
    const m = b.date?.match(/^(\w{3}) \d{1,2}, (\d{4})$/);
    if (!m) continue;
    const mo = MONTH_IDX[m[1]];
    if (mo === undefined) continue;
    const key = `${m[2]}-${String(mo + 1).padStart(2, "0")}`;
    monthly[key] = (monthly[key] ?? 0) + (b.vol ?? 0);
  }

  const data: Point[] = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vol]) => {
      const [yr, mo] = key.split("-");
      return {
        label: `${MONTH_ABBR[parseInt(mo) - 1]} '${yr.slice(2)}`,
        rev: Math.round(vol * TAKE_RATE * 1000) / 1000,
      };
    });

  const peak = data.reduce((m, d) => (d.rev > m.rev ? d : m), data[0]);
  return { data, peak };
}

export default function RevenueCurve() {
  const { data, peak } = useMemo(buildCurve, []);

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
          <span style={metaLabel}>MONTHLY PLATFORM REVENUE</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            estimated from tracker battles × {(TAKE_RATE * 100).toFixed(2)}% take rate · peak {peak.label}
          </p>
        </div>
      </div>

      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
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
              width={36}
              tickFormatter={(v: number) => `${v.toFixed(1)}`}
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
              formatter={(v: number) => [`${v.toFixed(3)} ◎`, "est. platform revenue"]}
            />
            <ReferenceLine
              y={peak.rev}
              stroke={`${C.dim}55`}
              strokeDasharray="4 3"
              label={{
                value: `peak ${peak.label}`,
                fill: C.dim,
                fontSize: 10,
                fontFamily: C.mono,
                position: "insideTopRight",
              }}
            />
            <Bar
              dataKey="rev"
              fill={C.accent}
              fillOpacity={0.8}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <Stat label="TOTAL REVENUE" value={`${BATTLE_STATS.platformRevenueSol.toFixed(2)} ◎`} />
        <Stat label="PEAK MONTH" value={peak.label} />
        <Stat label="PEAK REVENUE" value={`${peak.rev.toFixed(3)} ◎`} />
        <Stat label="TAKE RATE" value={`${(TAKE_RATE * 100).toFixed(2)}%`} dim />
      </div>

      <p style={{ marginTop: 12, fontFamily: C.mono, fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
        Monthly estimates from ww-battles.json × take rate — total uses exact BATTLE_STATS figure · tracker started May 2025
      </p>
    </div>
  );
}

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontFamily: C.mono,
          fontSize: 10,
          color: C.dim,
          letterSpacing: "0.06em",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: C.mono,
          fontSize: 14,
          color: dim ? C.dim : C.text,
          fontWeight: dim ? 400 : 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}
