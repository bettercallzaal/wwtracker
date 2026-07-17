"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; vol: number; type: string };
const battles = battlesRaw as Battle[];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function BattleCalendar() {
  const [metric, setMetric] = useState<"battles" | "vol">("battles");

  const { weeks, monthLabels, stats } = useMemo(() => {
    // Aggregate per day
    const perDay: Record<string, { count: number; vol: number }> = {};
    for (const b of battles) {
      const d = parseDate(b.date);
      if (!d) continue;
      const key = toKey(d);
      if (!perDay[key]) perDay[key] = { count: 0, vol: 0 };
      perDay[key].count++;
      perDay[key].vol += b.vol ?? 0;
    }

    // Build calendar grid: Sunday-aligned weeks from first Sunday on/before first battle
    const keys = Object.keys(perDay).sort();
    if (!keys.length) return { weeks: [], monthLabels: [], stats: { days: 0, max: 1, maxVol: 1 } };

    const first = new Date(keys[0] + "T00:00:00Z");
    const last = new Date(keys[keys.length - 1] + "T00:00:00Z");

    // Align start to the Sunday on or before first date
    const startSunday = new Date(first);
    startSunday.setUTCDate(first.getUTCDate() - first.getUTCDay());

    // Align end to the Saturday on or after last date
    const endSaturday = new Date(last);
    endSaturday.setUTCDate(last.getUTCDate() + (6 - last.getUTCDay()));

    const weekList: Array<Array<{ key: string; count: number; vol: number } | null>> = [];
    const monthLabelList: Array<{ label: string; col: number }> = [];
    let cur = new Date(startSunday);
    let weekIdx = 0;
    let lastMonth = -1;

    while (cur <= endSaturday) {
      const week: Array<{ key: string; count: number; vol: number } | null> = [];
      for (let d = 0; d < 7; d++) {
        const key = toKey(cur);
        const m = cur.getUTCMonth();
        if (d === 0 && m !== lastMonth) {
          monthLabelList.push({ label: MONTHS[m], col: weekIdx });
          lastMonth = m;
        }
        week.push({ key, ...(perDay[key] ?? { count: 0, vol: 0 }) });
        cur = new Date(cur.getTime() + 86400000);
      }
      weekList.push(week);
      weekIdx++;
    }

    const maxCount = Math.max(...Object.values(perDay).map((v) => v.count), 1);
    const maxVol = Math.max(...Object.values(perDay).map((v) => v.vol), 0.01);

    return {
      weeks: weekList,
      monthLabels: monthLabelList,
      stats: { days: keys.length, max: maxCount, maxVol },
    };
  }, []);

  // Color intensity — 5 buckets (0 = no activity)
  function cellColor(count: number, vol: number): string {
    const v = metric === "battles" ? count : vol;
    const max = metric === "battles" ? stats.max : stats.maxVol;
    if (v === 0) return C.panel;
    const t = Math.min(v / max, 1);
    // Amber ramp matching C.accent (#e8ab00)
    if (t < 0.2) return "#4a3800";
    if (t < 0.4) return "#7a5e00";
    if (t < 0.65) return "#b08600";
    if (t < 0.85) return "#d4a200";
    return "#e8ab00";
  }

  const CELL = 11;
  const GAP = 2;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <span style={metaLabel}>BATTLE ACTIVITY CALENDAR</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            {stats.days} active days · peak {stats.max} battles/day
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["battles", "vol"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              style={{
                fontFamily: C.mono, fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                border: `1px solid ${metric === m ? C.accent : C.grid}`,
                background: metric === m ? C.accent : "transparent",
                color: metric === m ? "#1a1206" : C.dim,
                fontWeight: metric === m ? 600 : 400,
              }}
            >
              {m === "battles" ? "# battles" : "volume ◎"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 0 }}>
          {/* Month labels */}
          <div style={{ display: "flex", paddingLeft: 28, marginBottom: 4 }}>
            {weeks.map((_, wi) => {
              const ml = monthLabels.find((m) => m.col === wi);
              return (
                <div
                  key={wi}
                  style={{ width: CELL + GAP, flexShrink: 0, fontFamily: C.mono, fontSize: 9, color: C.dim, overflow: "hidden" }}
                >
                  {ml ? ml.label : ""}
                </div>
              );
            })}
          </div>

          {/* Day rows (Sun–Sat) */}
          <div style={{ display: "flex", gap: 0 }}>
            {/* Day labels */}
            <div style={{ display: "flex", flexDirection: "column", gap: GAP, marginRight: 4, paddingTop: 0 }}>
              {DAYS.map((day, di) => (
                <div
                  key={day}
                  style={{
                    width: 22, height: CELL, display: "flex", alignItems: "center",
                    fontFamily: C.mono, fontSize: 9, color: C.dim,
                    visibility: di % 2 === 1 ? "visible" : "hidden",
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div style={{ display: "flex", gap: GAP }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                  {week.map((cell, di) => {
                    if (!cell) return <div key={di} style={{ width: CELL, height: CELL }} />;
                    const label =
                      metric === "battles"
                        ? cell.count === 0 ? "no battles" : `${cell.count} battle${cell.count !== 1 ? "s" : ""}`
                        : cell.vol === 0 ? "no volume" : `${cell.vol.toFixed(2)} ◎`;
                    return (
                      <div
                        key={di}
                        title={`${cell.key}: ${label}`}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 2,
                          background: cellColor(cell.count, cell.vol),
                          border: `1px solid ${C.grid}22`,
                          cursor: "default",
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, paddingLeft: 28 }}>
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginRight: 4 }}>less</span>
            {[C.panel, "#4a3800", "#7a5e00", "#b08600", "#d4a200", "#e8ab00"].map((bg, i) => (
              <div key={i} style={{ width: CELL, height: CELL, borderRadius: 2, background: bg, border: `1px solid ${C.grid}22` }} />
            ))}
            <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginLeft: 4 }}>more</span>
          </div>
        </div>
      </div>
    </div>
  );
}
