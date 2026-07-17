"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; vol: number };
const battles = battlesRaw as Battle[];

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlyVolume() {
  const [metric, setMetric] = useState<"vol" | "battles">("vol");

  const months = useMemo(() => {
    const acc: Record<string, { vol: number; count: number }> = {};
    for (const b of battles) {
      const d = new Date(b.date);
      if (isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 7);
      if (!acc[key]) acc[key] = { vol: 0, count: 0 };
      acc[key].vol += b.vol ?? 0;
      acc[key].count++;
    }
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [yr, mo] = key.split("-");
        return { key, label: `${MONTH_ABBR[parseInt(mo) - 1]} ${yr.slice(2)}`, vol: v.vol, count: v.count };
      });
  }, []);

  const values = months.map((m) => (metric === "vol" ? m.vol : m.count));
  const max = Math.max(...values, 0.01);
  const peakIdx = values.indexOf(max);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <span style={metaLabel}>MONTHLY ACTIVITY</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            peak: {months[peakIdx]?.label} —{" "}
            {metric === "vol"
              ? `${months[peakIdx]?.vol.toFixed(2)} ◎`
              : `${months[peakIdx]?.count} battles`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["vol", "battles"] as const).map((m) => (
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
              {m === "vol" ? "vol ◎" : "# battles"}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: months.length * 36, display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
          {months.map((m, i) => {
            const v = values[i];
            const pct = (v / max) * 100;
            const isPeak = i === peakIdx;
            const displayVal = metric === "vol" ? `${v.toFixed(1)} ◎` : `${v}`;
            return (
              <div key={m.key} style={{ flex: "0 0 32px", display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                  <div
                    title={`${m.label}: ${displayVal}`}
                    style={{
                      width: "100%",
                      height: `${Math.max(pct, 2)}%`,
                      background: isPeak ? C.accent : `${C.accent}55`,
                      borderRadius: "3px 3px 0 0",
                      transition: "height 0.2s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* X labels */}
        <div style={{ minWidth: months.length * 36, display: "flex", gap: 4, borderTop: `1px solid ${C.grid}`, paddingTop: 6, marginTop: 2 }}>
          {months.map((m, i) => (
            <div
              key={m.key}
              style={{
                flex: "0 0 32px",
                textAlign: "center",
                fontFamily: C.mono,
                fontSize: 9,
                color: i === peakIdx ? C.accent : C.dim,
                fontWeight: i === peakIdx ? 700 : 400,
                lineHeight: 1.3,
              }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
