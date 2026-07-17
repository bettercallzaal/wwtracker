"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { a: string; b: string; aHandle?: string; bHandle?: string; winner: string; vol: number };
const battles = battlesRaw as Battle[];

type SortKey = "battles" | "winPct" | "vol";
const MIN_QUALIFIED = 5;

export default function ArtistStandings() {
  const [sort, setSort] = useState<SortKey>("battles");

  const rows = useMemo(() => {
    const acc: Record<string, { battles: number; wins: number; losses: number; vol: number }> = {};
    for (const b of battles) {
      for (const [h, side] of [
        [b.aHandle, "a"],
        [b.bHandle, "b"],
      ] as [string | undefined, string][]) {
        if (!h || !b.aHandle || !b.bHandle || b.aHandle === b.bHandle) continue;
        if (!acc[h]) acc[h] = { battles: 0, wins: 0, losses: 0, vol: 0 };
        acc[h].battles++;
        acc[h].vol += b.vol ?? 0;
        const mySong = side === "a" ? b.a : b.b;
        const won = b.winner && b.winner.trim() === mySong.trim();
        if (won) acc[h].wins++;
        else if (b.winner) acc[h].losses++;
      }
    }
    return Object.entries(acc).map(([handle, v]) => ({
      handle,
      battles: v.battles,
      wins: v.wins,
      losses: v.losses,
      vol: v.vol,
      winPct: v.wins + v.losses > 0 ? (v.wins / (v.wins + v.losses)) * 100 : null,
      qualified: v.battles >= MIN_QUALIFIED,
    }));
  }, []);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "winPct") return copy.sort((a, b) => (b.winPct ?? -1) - (a.winPct ?? -1));
    if (sort === "vol") return copy.sort((a, b) => b.vol - a.vol);
    return copy.sort((a, b) => b.battles - a.battles);
  }, [rows, sort]);

  const maxBattles = Math.max(...rows.map((r) => r.battles), 1);
  const qualifiedCount = rows.filter((r) => r.qualified).length;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <span style={metaLabel}>ARTIST STANDINGS</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            {rows.length} tagged artists · {qualifiedCount} with {MIN_QUALIFIED}+ battles · handles tagged Jun 2026+
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["battles", "winPct", "vol"] as SortKey[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              style={{
                fontFamily: C.mono,
                fontSize: 11,
                padding: "5px 10px",
                borderRadius: 6,
                cursor: "pointer",
                border: `1px solid ${sort === s ? C.accent : C.grid}`,
                background: sort === s ? C.accent : "transparent",
                color: sort === s ? "#1a1206" : C.dim,
                fontWeight: sort === s ? 600 : 400,
              }}
            >
              {s === "battles" ? "battles" : s === "winPct" ? "win %" : "vol ◎"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}`, color: C.dim, textAlign: "left" }}>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, width: 28 }}>#</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>HANDLE</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>B</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>W</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>L</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>WIN %</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>VOL ◎</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const barW = Math.round((r.battles / maxBattles) * 100);
              const dim = !r.qualified ? 0.45 : 1;
              const winPctColor =
                r.qualified && r.winPct != null && r.winPct >= 65 ? C.accent : C.text;
              return (
                <tr
                  key={r.handle}
                  style={{ borderBottom: `1px solid ${C.grid}22`, opacity: dim }}
                >
                  <td style={{ padding: "5px 6px", color: C.dim, textAlign: "center" }}>{i + 1}</td>
                  <td
                    style={{
                      padding: "5px 6px",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: r.qualified ? C.text : C.dim,
                      fontWeight: r.qualified ? 600 : 400,
                    }}
                  >
                    {r.handle}
                    {!r.qualified && (
                      <span style={{ fontSize: 10, color: C.dim, marginLeft: 5 }}>small sample</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "center",
                      fontWeight: sort === "battles" ? 700 : 400,
                      color: sort === "battles" ? C.text : C.dim,
                    }}
                  >
                    {r.battles}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "center", color: C.accent }}>
                    {r.wins}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "center", color: C.dim }}>
                    {r.losses}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "right",
                      color: winPctColor,
                      fontWeight: sort === "winPct" ? 700 : 400,
                    }}
                  >
                    {r.winPct != null ? `${r.winPct.toFixed(0)}%` : "—"}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "right",
                      color: sort === "vol" ? C.text : C.dim,
                      fontWeight: sort === "vol" ? 700 : 400,
                    }}
                  >
                    {r.vol.toFixed(2)}
                  </td>
                  <td style={{ padding: "5px 6px" }}>
                    <div
                      style={{ height: 6, background: C.grid, borderRadius: 3, overflow: "hidden" }}
                    >
                      <div
                        style={{
                          width: `${barW}%`,
                          height: "100%",
                          background: r.qualified ? `${C.accent}88` : `${C.dim}44`,
                          borderRadius: 3,
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

      <p style={{ margin: "12px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 11, lineHeight: 1.5 }}>
        Dimmed rows have &lt;{MIN_QUALIFIED} battles — win % unreliable at small sample.
        Handle tagging started Jun 2026; earlier battles are handle-agnostic.
      </p>
    </div>
  );
}
