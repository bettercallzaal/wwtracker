"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { type: string; vol: number; margin: number };
const battles = battlesRaw as Battle[];

const TYPE_LABELS: Record<string, string> = {
  MAIN: "Main Event",
  QUICK: "Quick Battle",
  COMMUNITY: "Community",
};

const TYPE_DESC: Record<string, string> = {
  MAIN: "High-stakes battles with large prize pools — typically Monday events. Small count, enormous volume.",
  QUICK: "Standard song-vs-song format. The daily pulse of the platform.",
  COMMUNITY: "Charity / benefit battle series. Volume goes to a cause.",
};

export default function BattleTypeBreakdown() {
  const { types, total, totalVol } = useMemo(() => {
    const acc: Record<string, { count: number; vol: number; margins: number[] }> = {};
    for (const b of battles) {
      const t = b.type || "UNKNOWN";
      if (!acc[t]) acc[t] = { count: 0, vol: 0, margins: [] };
      acc[t].count++;
      acc[t].vol += b.vol ?? 0;
      if (b.margin != null) acc[t].margins.push(b.margin);
    }
    const total = battles.length;
    const totalVol = battles.reduce((s, b) => s + (b.vol ?? 0), 0);
    const order = ["MAIN", "COMMUNITY", "QUICK"];
    const types = order
      .filter((t) => acc[t])
      .map((t) => ({
        type: t,
        count: acc[t].count,
        vol: acc[t].vol,
        avgVol: acc[t].vol / acc[t].count,
        avgMargin:
          acc[t].margins.length > 0
            ? acc[t].margins.reduce((a, b) => a + b, 0) / acc[t].margins.length
            : null,
        pctCount: (acc[t].count / total) * 100,
        pctVol: (acc[t].vol / totalVol) * 100,
      }));
    return { types, total, totalVol };
  }, []);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <span style={metaLabel}>BATTLE TYPE BREAKDOWN</span>
      <p style={{ margin: "4px 0 14px", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
        MAIN events are 3.6% of all battles but drive 70% of total volume.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {types.map((t) => (
          <div
            key={t.type}
            style={{
              background: C.bg,
              border: `1px solid ${t.type === "MAIN" ? C.accent : C.grid}`,
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: t.type === "MAIN" ? C.accent : C.dim,
                }}
              >
                {TYPE_LABELS[t.type] ?? t.type}
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>
                {t.pctVol.toFixed(0)}% vol
              </span>
            </div>

            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {t.count}
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim, marginLeft: 6 }}>
                battles ({t.pctCount.toFixed(1)}%)
              </span>
            </div>

            {/* Volume share bar */}
            <div style={{ height: 6, background: C.grid, borderRadius: 3, marginBottom: 12, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${t.pctVol}%`,
                  background: t.type === "MAIN" ? C.accent : `${C.accent}55`,
                  borderRadius: 3,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontFamily: C.mono, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.dim }}>total vol</span>
                <span>{t.vol.toFixed(2)} ◎</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: C.dim }}>avg/battle</span>
                <span style={{ color: t.type === "MAIN" ? C.accent : C.text, fontWeight: t.type === "MAIN" ? 700 : 400 }}>
                  {t.avgVol.toFixed(3)} ◎
                </span>
              </div>
              {t.avgMargin != null && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: C.dim }}>avg margin</span>
                  <span>{t.avgMargin.toFixed(0)}%</span>
                </div>
              )}
            </div>

            <p style={{ margin: "10px 0 0", color: C.dim, fontSize: 11, fontFamily: C.mono, lineHeight: 1.5 }}>
              {TYPE_DESC[t.type] ?? ""}
            </p>
          </div>
        ))}
      </div>

      {/* Volume stacked bar */}
      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginBottom: 6 }}>
          volume split — {totalVol.toFixed(2)} ◎ total
        </div>
        <div style={{ height: 10, background: C.bg, borderRadius: 5, overflow: "hidden", display: "flex", border: `1px solid ${C.grid}` }}>
          {types.map((t) => (
            <div
              key={t.type}
              title={`${TYPE_LABELS[t.type]}: ${t.pctVol.toFixed(1)}%`}
              style={{
                width: `${t.pctVol}%`,
                height: "100%",
                background:
                  t.type === "MAIN"
                    ? C.accent
                    : t.type === "COMMUNITY"
                    ? `${C.accent}88`
                    : `${C.accent}33`,
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
          {types.map((t) => (
            <div key={t.type} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: C.mono, fontSize: 11, color: C.dim }}>
              <div
                style={{
                  width: 10, height: 10, borderRadius: 2, flexShrink: 0,
                  background:
                    t.type === "MAIN" ? C.accent : t.type === "COMMUNITY" ? `${C.accent}88` : `${C.accent}33`,
                }}
              />
              {TYPE_LABELS[t.type]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
