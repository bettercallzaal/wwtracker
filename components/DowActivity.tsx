"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; vol: number; type: string };
const battles = battlesRaw as Battle[];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DowActivity() {
  const [metric, setMetric] = useState<"battles" | "vol" | "avg">("battles");

  const rows = useMemo(() => {
    const acc = Array.from({ length: 7 }, () => ({ count: 0, vol: 0 }));
    for (const b of battles) {
      const d = new Date(b.date);
      if (isNaN(d.getTime())) continue;
      const dow = d.getDay();
      acc[dow].count++;
      acc[dow].vol += b.vol ?? 0;
    }
    return acc.map((r, i) => ({
      day: DAYS[i],
      count: r.count,
      vol: r.vol,
      avg: r.count > 0 ? r.vol / r.count : 0,
    }));
  }, []);

  const values = rows.map((r) => (metric === "battles" ? r.count : metric === "vol" ? r.vol : r.avg));
  const max = Math.max(...values, 0.01);

  const label = metric === "battles" ? "# battles" : metric === "vol" ? "volume ◎" : "avg vol/battle ◎";

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div>
          <span style={metaLabel}>ACTIVITY BY DAY OF WEEK</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            Mon drives the most volume — big MAIN events. Sat–Fri run the most quick battles.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["battles", "vol", "avg"] as const).map((m) => (
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
              {m === "battles" ? "# battles" : m === "vol" ? "vol ◎" : "avg ◎/battle"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => {
          const v = values[i];
          const pct = (v / max) * 100;
          const isMon = r.day === "Mon";
          const displayVal = metric === "battles" ? r.count.toString() : v.toFixed(metric === "avg" ? 3 : 1);
          return (
            <div key={r.day} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 30, fontFamily: C.mono, fontSize: 12, color: isMon ? C.accent : C.dim, fontWeight: isMon ? 700 : 400, flexShrink: 0 }}>
                {r.day}
              </div>
              <div style={{ flex: 1, height: 22, background: C.bg, borderRadius: 4, overflow: "hidden", border: `1px solid ${C.grid}` }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: isMon ? C.accent : `${C.accent}66`,
                    borderRadius: 4,
                    transition: "width 0.25s ease",
                  }}
                />
              </div>
              <div style={{ width: 72, fontFamily: C.mono, fontSize: 12, color: isMon ? C.accent : C.text, fontWeight: isMon ? 700 : 400, textAlign: "right", flexShrink: 0 }}>
                {displayVal} {metric !== "battles" ? "◎" : ""}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ ...metaLabel, fontSize: 10, marginTop: 14, lineHeight: 1.6 }}>
        {label} · all {battles.length.toLocaleString()} battles in the dataset · Mon events are high-stakes MAIN battles with large prize pools.
      </p>
    </div>
  );
}
