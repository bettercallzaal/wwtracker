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
};

const battles = (battlesRaw as Battle[]).slice().sort((a, b) => Number(a.id) - Number(b.id));

interface WinRateRow {
  rank: number;
  handle: string;
  wins: number;
  losses: number;
  total: number;
  winPct: number;
}

function computeWinRates(): WinRateRow[] {
  const map = new Map<string, { wins: number; losses: number }>();

  for (const b of battles) {
    for (const [handle, side] of [
      [b.aHandle, "a"],
      [b.bHandle, "b"],
    ] as [string | null | undefined, string][]) {
      if (!handle) continue;
      if (!map.has(handle)) map.set(handle, { wins: 0, losses: 0 });
      const s = map.get(handle)!;
      if (!b.winner || b.winner.trim() === "") continue;
      const mySong = side === "a" ? b.a : b.b;
      if (b.winner.trim() === mySong.trim()) {
        s.wins++;
      } else {
        s.losses++;
      }
    }
  }

  return [...map.entries()]
    .map(([handle, v]) => ({
      handle,
      wins: v.wins,
      losses: v.losses,
      total: v.wins + v.losses,
      winPct: v.wins + v.losses > 0 ? (v.wins / (v.wins + v.losses)) * 100 : 0,
    }))
    .filter((r) => r.total >= 5)
    .sort((a, b) => b.winPct - a.winPct || b.total - a.total)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export default function WinRateLeaderboard() {
  const rows = useMemo(computeWinRates, []);

  if (rows.length === 0) return null;

  const topWinPct = rows[0].winPct;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>WIN RATE — ARTIST STANDINGS</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          {rows.length} artists · min 5 decided battles · handles tagged Jun 2026+
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: C.mono,
            fontSize: 12,
            minWidth: 420,
          }}
        >
          <thead>
            <tr style={{ color: C.dim }}>
              <th style={th}>#</th>
              <th style={{ ...th, textAlign: "left" }}>HANDLE</th>
              <th style={{ ...th, textAlign: "right" }}>W</th>
              <th style={{ ...th, textAlign: "right" }}>L</th>
              <th style={{ ...th, textAlign: "right" }}>WIN%</th>
              <th style={{ ...th, minWidth: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const barPct = topWinPct > 0 ? (r.winPct / topWinPct) * 100 : 0;
              const isTop3 = r.rank <= 3;
              return (
                <tr
                  key={r.handle}
                  style={{
                    borderTop: `1px solid ${C.grid}`,
                    color: isTop3 ? C.text : C.dim,
                  }}
                >
                  <td style={{ ...td, color: isTop3 ? C.accent : C.dim, fontWeight: isTop3 ? 700 : 400 }}>
                    {r.rank}
                  </td>
                  <td style={{ ...td, textAlign: "left", color: C.text }}>
                    <a
                      href={`https://x.com/${r.handle}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "inherit", textDecoration: "none" }}
                    >
                      {r.handle}
                    </a>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: C.accent }}>{r.wins}</td>
                  <td style={{ ...td, textAlign: "right" }}>{r.losses}</td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      fontWeight: 700,
                      color: isTop3 ? C.accent : C.text,
                    }}
                  >
                    {r.winPct.toFixed(1)}%
                  </td>
                  <td style={{ ...td, paddingLeft: 8, paddingRight: 4 }}>
                    <div
                      style={{
                        height: 4,
                        borderRadius: 2,
                        background: C.bg,
                        overflow: "hidden",
                        width: "100%",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${barPct}%`,
                          background: isTop3 ? C.accent : C.dim,
                          borderRadius: 2,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
        draws and battles without a declared winner excluded from win% · only handle-tagged battles counted
      </p>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "6px 8px",
  fontWeight: 400,
  letterSpacing: "0.06em",
  fontSize: 10,
  textAlign: "right",
};

const td: React.CSSProperties = {
  padding: "7px 8px",
  whiteSpace: "nowrap",
};
