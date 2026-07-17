"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { aHandle?: string; bHandle?: string; a: string; winner: string; vol: number };
const battles = battlesRaw as Battle[];

type Rivalry = { lo: string; hi: string; count: number; loWins: number; hiWins: number; vol: number };

export default function TopRivalries() {
  const rivalries = useMemo<Rivalry[]>(() => {
    const map = new Map<string, Rivalry>();

    for (const b of battles) {
      const aH = b.aHandle;
      const bH = b.bHandle;
      if (!aH || !bH || aH === bH) continue;

      const [lo, hi] = aH < bH ? [aH, bH] : [bH, aH];
      const key = `${lo}|||${hi}`;
      let r = map.get(key);
      if (!r) { r = { lo, hi, count: 0, loWins: 0, hiWins: 0, vol: 0 }; map.set(key, r); }

      r.count++;
      r.vol += b.vol ?? 0;

      const winnerHandle = b.winner === b.a ? aH : bH;
      if (winnerHandle === lo) r.loWins++; else r.hiWins++;
    }

    return [...map.values()]
      .filter((r) => r.count >= 2)
      .sort((a, b) => b.count - a.count || b.vol - a.vol);
  }, []);

  const taggedTotal = useMemo(
    () => battles.filter((b) => b.aHandle && b.bHandle && b.aHandle !== b.bHandle).length,
    []
  );

  if (rivalries.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>ARTIST RIVALRIES</span>
        <p style={{ margin: "6px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12, lineHeight: 1.5 }}>
          artist pairings with 2+ battles in the tagged dataset · leader highlighted
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {rivalries.map((r, i) => {
          const tied = r.loWins === r.hiWins;
          const leader = tied ? null : r.loWins > r.hiWins ? r.lo : r.hi;
          const leadWins = tied ? r.loWins : Math.max(r.loWins, r.hiWins);
          const trailWins = tied ? r.hiWins : Math.min(r.loWins, r.hiWins);

          return (
            <div
              key={`${r.lo}-${r.hi}`}
              style={{
                display: "grid",
                gridTemplateColumns: "2.5rem 1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "9px 0",
                borderTop: i > 0 ? `1px solid ${C.grid}` : "none",
              }}
            >
              <span style={{ fontFamily: C.mono, fontSize: 12, color: C.accent, textAlign: "right", fontWeight: 700 }}>
                {r.count}×
              </span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: r.lo === leader ? C.text : C.dim }}>
                  {r.lo}
                </span>
                <span style={{ color: C.dim, fontSize: 12, margin: "0 6px" }}>vs</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: r.hi === leader ? C.text : C.dim }}>
                  {r.hi}
                </span>
                <span style={{ marginLeft: 8, fontFamily: C.mono, fontSize: 11, color: C.dim }}>
                  {tied ? `${leadWins}–${trailWins} tied` : `${leadWins}–${trailWins}`}
                </span>
              </div>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, whiteSpace: "nowrap" }}>
                {r.vol.toFixed(2)} ◎
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ margin: "12px 0 0", fontFamily: C.mono, fontSize: 11, color: C.dim }}>
        from {taggedTotal} handle-tagged cross-artist battles · untagged battles excluded
      </p>
    </div>
  );
}
