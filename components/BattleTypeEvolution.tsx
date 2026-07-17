"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; type: string; vol: number };
const battles = battlesRaw as Battle[];

const TYPE_COLOR: Record<string, string> = {
  MAIN: C.accent,
  QUICK: "#60a5fa",
  COMMUNITY: "#a78bfa",
};
const TYPE_LABEL: Record<string, string> = {
  MAIN: "Main Event",
  QUICK: "Quick Battle",
  COMMUNITY: "Community",
};

type QRow = {
  q: string;
  MAIN: number;
  QUICK: number;
  COMMUNITY: number;
  mainVol: number;
  quickVol: number;
  communVol: number;
  total: number;
  totalVol: number;
};

function quarterKey(d: Date) {
  return "Q" + (Math.floor(d.getMonth() / 3) + 1) + " " + d.getFullYear();
}

export default function BattleTypeEvolution() {
  const rows = useMemo<QRow[]>(() => {
    const acc: Record<string, QRow> = {};
    for (const b of battles) {
      const k = quarterKey(new Date(b.date));
      if (!acc[k]) {
        acc[k] = { q: k, MAIN: 0, QUICK: 0, COMMUNITY: 0, mainVol: 0, quickVol: 0, communVol: 0, total: 0, totalVol: 0 };
      }
      acc[k][b.type as "MAIN" | "QUICK" | "COMMUNITY"]++;
      acc[k].total++;
      acc[k].totalVol += b.vol ?? 0;
      if (b.type === "MAIN") acc[k].mainVol += b.vol ?? 0;
      if (b.type === "QUICK") acc[k].quickVol += b.vol ?? 0;
      if (b.type === "COMMUNITY") acc[k].communVol += b.vol ?? 0;
    }
    return Object.values(acc).sort((a, b) => {
      const parse = (s: string) => {
        const [q, y] = s.replace("Q", "").split(" ");
        return +y * 10 + +q;
      };
      return parse(a.q) - parse(b.q);
    });
  }, []);

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);
  const maxVol = Math.max(...rows.map((r) => r.totalVol), 1);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>BATTLE TYPE EVOLUTION</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          quarter-by-quarter breakdown — how the format mix has shifted over time
        </p>
      </div>

      {/* Stacked bar chart */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", overflowX: "auto", paddingBottom: 6, minWidth: 0 }}>
        {rows.map((r) => {
          const barH = Math.round((r.total / maxTotal) * 140);
          const mainH = barH > 0 ? Math.round((r.MAIN / r.total) * barH) : 0;
          const commH = barH > 0 ? Math.round((r.COMMUNITY / r.total) * barH) : 0;
          const quickH = barH - mainH - commH;

          return (
            <div key={r.q} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", minWidth: 52 }}>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginBottom: 4, textAlign: "center" }}>
                {r.total}
              </div>
              {/* Stacked bar */}
              <div
                style={{ width: 36, height: 140, display: "flex", flexDirection: "column-reverse", background: `${C.grid}22`, borderRadius: 4, overflow: "hidden" }}
                title={`${r.q}: ${r.MAIN}M / ${r.QUICK}Q / ${r.COMMUNITY}C`}
              >
                {mainH > 0 && (
                  <div style={{ width: "100%", height: mainH, background: TYPE_COLOR.MAIN, flexShrink: 0 }} />
                )}
                {commH > 0 && (
                  <div style={{ width: "100%", height: commH, background: TYPE_COLOR.COMMUNITY, flexShrink: 0 }} />
                )}
                {quickH > 0 && (
                  <div style={{ width: "100%", height: quickH, background: TYPE_COLOR.QUICK, flexShrink: 0 }} />
                )}
              </div>
              <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginTop: 6, textAlign: "center", whiteSpace: "nowrap" }}>
                {r.q}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        {(["QUICK", "COMMUNITY", "MAIN"] as const).map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: C.mono, fontSize: 11, color: C.dim }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLOR[t], flexShrink: 0 }} />
            {TYPE_LABEL[t]}
          </div>
        ))}
      </div>

      {/* Per-quarter detail table */}
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}`, color: C.dim, textAlign: "left" }}>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>QTR</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>MAIN</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>MAIN VOL ◎</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>QUICK</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>QUICK VOL ◎</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>COMM</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>TOTAL VOL ◎</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isPeak = r.totalVol === Math.max(...rows.map((x) => x.totalVol));
              return (
                <tr key={r.q} style={{ borderBottom: `1px solid ${C.grid}22` }}>
                  <td style={{ padding: "5px 6px", color: isPeak ? C.accent : C.text, fontWeight: isPeak ? 700 : 400, whiteSpace: "nowrap" }}>
                    {r.q} {isPeak ? "★" : ""}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: r.MAIN > 0 ? C.accent : C.dim }}>
                    {r.MAIN > 0 ? r.MAIN : "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: C.dim }}>
                    {r.mainVol > 0 ? r.mainVol.toFixed(1) : "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: r.QUICK > 0 ? "#60a5fa" : C.dim }}>
                    {r.QUICK > 0 ? r.QUICK : "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: C.dim }}>
                    {r.quickVol > 0 ? r.quickVol.toFixed(1) : "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: r.COMMUNITY > 0 ? "#a78bfa" : C.dim }}>
                    {r.COMMUNITY > 0 ? r.COMMUNITY : "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: isPeak ? 700 : 400, color: isPeak ? C.accent : C.text }}>
                    {r.totalVol.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: "12px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 11, lineHeight: 1.5 }}>
        MAIN events average ~12 ◎/battle vs ~0.15 ◎ for QUICK — format determines bet scale.
        Q3 2026 is partial (through Jul 14, 2026).
      </p>
    </div>
  );
}
