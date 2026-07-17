"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { aHandle?: string; bHandle?: string; a: string; b: string; winner: string; vol: number; margin: number; date: string };
const battles = battlesRaw as Battle[];

const SHOW = 10;

export default function NailBiters() {
  const closest = useMemo(() => {
    return battles
      .filter((b) => b.aHandle && b.bHandle && b.aHandle !== b.bHandle && b.vol > 0 && b.margin != null)
      .sort((a, b) => a.margin - b.margin)
      .slice(0, SHOW)
      .map((b) => {
        const winnerHandle = b.winner === b.a ? b.aHandle! : b.bHandle!;
        const loserHandle = winnerHandle === b.aHandle ? b.bHandle! : b.aHandle!;
        return { winner: winnerHandle, loser: loserHandle, margin: b.margin, vol: b.vol, date: b.date };
      });
  }, []);

  if (closest.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>NAIL BITERS</span>
        <p style={{ margin: "6px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12, lineHeight: 1.5 }}>
          the {SHOW} closest battles ever — by victory margin, cross-artist tagged battles with trading volume
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {closest.map((b, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "2.5rem 1fr auto auto",
              alignItems: "center",
              gap: 10,
              padding: "9px 0",
              borderTop: i > 0 ? `1px solid ${C.grid}` : "none",
            }}
          >
            <span style={{ fontFamily: C.mono, fontSize: 13, color: b.margin === 0 ? C.accent : C.dim, fontWeight: b.margin === 0 ? 700 : 400, textAlign: "right" }}>
              {b.margin}%
            </span>
            <div style={{ fontFamily: C.mono, fontSize: 12, lineHeight: 1.4, minWidth: 0 }}>
              <span style={{ color: C.text, fontWeight: 600 }}>{b.winner}</span>
              <span style={{ color: C.dim }}> def. {b.loser}</span>
            </div>
            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>{b.date}</span>
            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>{b.vol.toFixed(2)} ◎</span>
          </div>
        ))}
      </div>

      <p style={{ margin: "12px 0 0", fontFamily: C.mono, fontSize: 11, color: C.dim }}>
        0% margin = exact dead heat in trader votes
      </p>
    </div>
  );
}
