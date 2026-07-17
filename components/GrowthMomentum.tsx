"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; vol: number };
const battles = battlesRaw as Battle[];

const MONTH_IDX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};
const MONTH_NAME = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function parseDateMs(s: string): number | null {
  const m = s.match(/^(\w{3}) (\d{1,2}), (\d{4})$/);
  if (!m) return null;
  const mo = MONTH_IDX[m[1]];
  if (mo === undefined) return null;
  return Date.UTC(parseInt(m[3]), mo, parseInt(m[2]));
}

export default function GrowthMomentum() {
  const stats = useMemo(() => {
    const parsed: number[] = [];
    for (const b of battles) {
      const ms = parseDateMs(b.date ?? "");
      if (ms !== null) parsed.push(ms);
    }
    if (!parsed.length) return null;

    // Use latest battle date as the reference anchor (not wall clock, so the
    // tiles stay stable until the next battles refresh).
    const latestMs = Math.max(...parsed);
    const ms30 = 30 * 24 * 60 * 60 * 1000;
    const cutoff30 = latestMs - ms30;
    const cutoff60 = latestMs - 2 * ms30;

    let last30 = 0, prev30 = 0;
    for (const ms of parsed) {
      if (ms > cutoff30) last30++;
      else if (ms > cutoff60) prev30++;
    }
    const pct = prev30 > 0 ? Math.round(((last30 - prev30) / prev30) * 100) : null;

    // Monthly aggregation
    const monthly = new Map<string, number>();
    for (const b of battles) {
      const mm = b.date?.match(/^(\w{3}) \d+, (\d{4})$/);
      if (!mm) continue;
      const mo = MONTH_IDX[mm[1]];
      if (mo === undefined) continue;
      const key = `${mm[2]}-${String(mo + 1).padStart(2, "0")}`;
      monthly.set(key, (monthly.get(key) ?? 0) + 1);
    }

    // Peak month
    let peakKey = "", peakCount = 0;
    for (const [k, v] of monthly) {
      if (v > peakCount) { peakCount = v; peakKey = k; }
    }
    const [pYr, pMo] = peakKey.split("-");
    const peakLabel = `${MONTH_NAME[parseInt(pMo) - 1]} '${pYr.slice(2)}`;

    // Current month projection
    const latestDate = new Date(latestMs);
    const curYr = latestDate.getUTCFullYear();
    const curMo = latestDate.getUTCMonth();
    const curKey = `${curYr}-${String(curMo + 1).padStart(2, "0")}`;
    const curCount = monthly.get(curKey) ?? 0;
    const daysSoFar = latestDate.getUTCDate();
    const daysInMonth = new Date(Date.UTC(curYr, curMo + 1, 0)).getUTCDate();
    const projected = Math.round((curCount / daysSoFar) * daysInMonth);
    const curLabel = `${MONTH_NAME[curMo]} '${String(curYr).slice(2)}`;

    return { last30, prev30, pct, peakLabel, peakCount, projected, curLabel, curCount };
  }, []);

  if (!stats) return null;
  const { last30, prev30, pct, peakLabel, peakCount, projected, curLabel, curCount } = stats;

  const trendStr = pct === null ? "—" : pct >= 0 ? `+${pct}%` : `${pct}%`;
  const trendColor = pct !== null && pct >= 0 ? C.accent : "#f87171";

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>MOMENTUM</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          rolling 30-day battle pace vs. prior 30 days
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        <Tile label="LAST 30 DAYS" value={String(last30)} sub="battles" />
        <Tile label="PRIOR 30 DAYS" value={String(prev30)} sub="battles" />
        <Tile label="30-DAY TREND" value={trendStr} sub="vs prior period" color={trendColor} />
        <Tile label={`${curLabel} (PACE)`} value={String(projected)} sub={`${curCount} so far · on-pace projection`} />
        <Tile label="PEAK MONTH" value={peakLabel} sub={`${peakCount} battles`} />
      </div>
      <p style={{ ...metaLabel, fontSize: 11, marginTop: 10, lineHeight: 1.6 }}>
        Windows roll from the latest battle in the dataset. Projection = (battles so far ÷ day of month) × days in month.
      </p>
    </div>
  );
}

function Tile({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: color ?? C.text }}>
        {value}
      </span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 11 }}>{sub}</span>
    </div>
  );
}
