"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { margin: number };
const battles = battlesRaw as Battle[];

const BUCKETS = [
  { label: "0–20%", desc: "very close", min: 0, max: 20 },
  { label: "21–40%", desc: "competitive", min: 21, max: 40 },
  { label: "41–60%", desc: "clear winner", min: 41, max: 60 },
  { label: "61–80%", desc: "dominant", min: 61, max: 80 },
  { label: "81–100%", desc: "blowout", min: 81, max: 100 },
];

export default function MarginDistribution() {
  const { buckets, total, avg, median } = useMemo(() => {
    const margins = battles.map((b) => b.margin).filter((m) => m != null && !isNaN(m));
    const total = margins.length;
    const avg = total > 0 ? margins.reduce((a, b) => a + b, 0) / total : 0;
    const sorted = [...margins].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    const buckets = BUCKETS.map((bk) => {
      const count = margins.filter((m) => m >= bk.min && m <= bk.max).length;
      return { ...bk, count, pct: total > 0 ? (count / total) * 100 : 0 };
    });
    return { buckets, total, avg, median };
  }, []);

  const maxPct = Math.max(...buckets.map((b) => b.pct), 1);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <span style={metaLabel}>BATTLE MARGIN DISTRIBUTION</span>
      <p style={{ margin: "4px 0 16px", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
        how decisive the wins are — bimodal: battles are either very close or total blowouts.
        avg margin {avg.toFixed(0)}% · median {median}%
      </p>

      {/* Histogram bars */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, marginBottom: 8 }}>
        {buckets.map((bk) => {
          const isFirst = bk.min === 0;
          const isLast = bk.max === 100;
          const highlight = isFirst || isLast;
          const barH = Math.round((bk.pct / maxPct) * 100);
          return (
            <div key={bk.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontFamily: C.mono, fontSize: 11, color: highlight ? C.accent : C.text, fontWeight: highlight ? 700 : 400 }}>
                {bk.pct.toFixed(0)}%
              </div>
              <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "flex-end" }}>
                <div
                  title={`${bk.label} (${bk.desc}): ${bk.count} battles (${bk.pct.toFixed(1)}%)`}
                  style={{
                    width: "100%",
                    height: `${barH}%`,
                    minHeight: 4,
                    background: highlight ? C.accent : `${C.accent}55`,
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.2s ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* X axis labels */}
      <div style={{ display: "flex", gap: 8 }}>
        {buckets.map((bk) => (
          <div key={bk.label} style={{ flex: 1, textAlign: "center", fontFamily: C.mono, fontSize: 10, color: C.dim }}>
            <div>{bk.label}</div>
            <div style={{ opacity: 0.7 }}>{bk.desc}</div>
          </div>
        ))}
      </div>

      {/* Count row */}
      <div style={{ display: "flex", gap: 8, marginTop: 10, borderTop: `1px solid ${C.grid}`, paddingTop: 10 }}>
        {buckets.map((bk) => (
          <div key={bk.label} style={{ flex: 1, textAlign: "center", fontFamily: C.mono, fontSize: 11, color: C.dim }}>
            {bk.count} battles
          </div>
        ))}
      </div>

      <p style={{ ...metaLabel, fontSize: 10, marginTop: 12, lineHeight: 1.6 }}>
        {total.toLocaleString()} battles with margin data. Margin = winning pool share minus losing pool share.
        The bimodal distribution suggests two distinct crowd behaviors: true contests vs. consensus bets.
      </p>
    </div>
  );
}
