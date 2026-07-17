"use client";

import { useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; vol: number };
const battles = battlesRaw as Battle[];

const MON_FMT: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function parseMonth(dateStr: string): string | null {
  // "Jun 13, 2025" → "2025-06"
  const m = dateStr.match(/^(\w{3}) \d+, (\d{4})$/);
  if (!m) return null;
  const MONTHS: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const mo = MONTHS[m[1]];
  if (!mo) return null;
  return `${m[2]}-${mo}`;
}

interface MonthRow { month: string; label: string; count: number; vol: number; peak: boolean; }

function computeMonthly(): MonthRow[] {
  const agg = new Map<string, { count: number; vol: number }>();
  for (const b of battles) {
    const month = parseMonth(b.date || "");
    if (!month) continue;
    const entry = agg.get(month) ?? { count: 0, vol: 0 };
    entry.count++;
    entry.vol += b.vol ?? 0;
    agg.set(month, entry);
  }
  const rows: MonthRow[] = [...agg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => {
      const [yr, mo] = month.split("-");
      const short = yr.slice(2);
      return { month, label: `${MON_FMT[mo]} '${short}`, count: d.count, vol: Math.round(d.vol * 10) / 10, peak: false };
    });
  const peakCount = Math.max(...rows.map((r) => r.count));
  rows.forEach((r) => { if (r.count === peakCount) r.peak = true; });
  return rows;
}

export default function BattleTempo() {
  const rows = useMemo(computeMonthly, []);
  const peak = rows.find((r) => r.peak);
  const current = rows[rows.length - 1];

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>BATTLE TEMPO</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          monthly battles and SOL volume — {rows[0]?.label} → {current?.label}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 12, marginBottom: 18 }}>
        {peak && (
          <Stat label="PEAK MONTH" value={peak.label} sub={`${peak.count} battles · ${peak.vol.toFixed(1)} ◎`} amber />
        )}
        <Stat label="MONTHS ACTIVE" value={String(rows.length)} sub="since May 2025" />
        <Stat
          label={`${current?.label ?? "CURRENT"} (partial)`}
          value={String(current?.count ?? 0)}
          sub={`${current?.vol.toFixed(1) ?? 0} ◎ volume`}
        />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 10 }}
            tickLine={false}
            interval={1}
            angle={-35}
            textAnchor="end"
            height={44}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: C.dim, fontFamily: C.mono, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 8, fontFamily: C.mono, fontSize: 12 }}
            labelStyle={{ color: C.text }}
            formatter={(val: number, name: string) =>
              name === "battles" ? [`${val}`, "battles"] : [`${val} ◎`, "volume"]
            }
          />
          <Legend
            wrapperStyle={{ fontFamily: C.mono, fontSize: 11, paddingTop: 6 }}
            formatter={(val) => <span style={{ color: C.dim }}>{val}</span>}
          />
          <Bar yAxisId="left" dataKey="count" name="battles" fill={C.accent} opacity={0.85} radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" dataKey="vol" name="volume (◎)" type="monotone" stroke={C.dim} strokeWidth={1.5} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <p style={{ ...metaLabel, fontSize: 10, marginTop: 10 }}>
        computed from public/ww-battles.json snapshot · current month is partial
      </p>
    </div>
  );
}

function Stat({ label, value, sub, amber }: { label: string; value: string; sub: string; amber?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: amber ? C.accent : C.text }}>
        {value}
      </span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}
