"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = {
  id: string;
  a: string;
  b: string;
  aHandle?: string | null;
  bHandle?: string | null;
  winner: string;
  vol: number;
};

const battles = battlesRaw as Battle[];

interface ArtistVolRow {
  handle: string;
  totalVol: number;
  battleCount: number;
  avgVol: number;
}

function computeArtistVol(): ArtistVolRow[] {
  const map = new Map<string, { vol: number; count: number }>();

  for (const b of battles) {
    const { aHandle, bHandle, vol } = b;
    if (!aHandle || !bHandle || aHandle === bHandle) continue;
    for (const handle of [aHandle, bHandle]) {
      const entry = map.get(handle) ?? { vol: 0, count: 0 };
      entry.vol += vol;
      entry.count++;
      map.set(handle, entry);
    }
  }

  return [...map.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([handle, v]) => ({
      handle,
      totalVol: v.vol,
      battleCount: v.count,
      avgVol: v.vol / v.count,
    }))
    .sort((a, b) => b.totalVol - a.totalVol);
}

export default function ArtistVolume() {
  const rows = useMemo(computeArtistVol, []);
  const maxVol = rows[0]?.totalVol ?? 1;
  const TOP = rows.slice(0, 15);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>ARTIST VOLUME</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          total SOL traded in cross-artist battles · handles tagged Jun 2026+
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {TOP.map((r, i) => {
          const pct = (r.totalVol / maxVol) * 100;
          const amber = i < 3;
          return (
            <div key={r.handle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 11,
                  color: C.dim,
                  minWidth: 18,
                  textAlign: "right",
                }}
              >
                {i + 1}
              </span>
              <div
                style={{
                  position: "relative",
                  flex: 1,
                  height: 22,
                  background: C.bg,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${pct}%`,
                    background: amber ? `${C.accent}44` : `${C.grid}`,
                    borderRadius: 4,
                  }}
                />
                <a
                  href={`https://x.com/${r.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    position: "absolute",
                    left: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontFamily: C.mono,
                    fontSize: 11,
                    color: amber ? C.accent : C.text,
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "65%",
                  }}
                >
                  {r.handle}
                </a>
              </div>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 12,
                  color: amber ? C.accent : C.dim,
                  minWidth: 64,
                  textAlign: "right",
                  fontWeight: amber ? 700 : 400,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.totalVol.toFixed(2)} ◎
              </span>
              <span
                style={{
                  fontFamily: C.mono,
                  fontSize: 11,
                  color: C.dim,
                  minWidth: 32,
                  textAlign: "right",
                }}
              >
                {r.battleCount}b
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
        cross-artist battles only · self-battles excluded · min 2 battles to qualify
      </p>
    </div>
  );
}
