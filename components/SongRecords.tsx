"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { a: string; b: string; winner: string; vol: number };
const battles = battlesRaw as Battle[];

type SortKey = "battles" | "wins" | "vol" | "winPct";

const MIN_BATTLES = 3;

export default function SongRecords() {
  const [sort, setSort] = useState<SortKey>("battles");
  const [limit, setLimit] = useState(25);

  const songs = useMemo(() => {
    const acc: Record<string, { battles: number; wins: number; losses: number; vol: number }> = {};
    for (const b of battles) {
      for (const song of [b.a, b.b]) {
        if (!song) continue;
        const key = song.trim();
        if (!acc[key]) acc[key] = { battles: 0, wins: 0, losses: 0, vol: 0 };
        acc[key].battles++;
        acc[key].vol += b.vol ?? 0;
        if (b.winner && b.winner.trim() === key) acc[key].wins++;
        else if (b.winner) acc[key].losses++;
      }
    }
    return Object.entries(acc)
      .filter(([, v]) => v.battles >= MIN_BATTLES)
      .map(([title, v]) => ({
        title,
        battles: v.battles,
        wins: v.wins,
        losses: v.losses,
        vol: v.vol,
        winPct: (v.wins + v.losses) > 0 ? (v.wins / (v.wins + v.losses)) * 100 : null,
      }));
  }, []);

  const sorted = useMemo(() => {
    const copy = [...songs];
    if (sort === "wins") return copy.sort((a, b) => b.wins - a.wins);
    if (sort === "vol") return copy.sort((a, b) => b.vol - a.vol);
    if (sort === "winPct") return copy.sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0));
    return copy.sort((a, b) => b.battles - a.battles);
  }, [songs, sort]);

  const displayed = sorted.slice(0, limit);
  const maxBattles = Math.max(...songs.map((s) => s.battles), 1);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <span style={metaLabel}>SONG BATTLE RECORDS</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            {songs.length} tracks with {MIN_BATTLES}+ battles · 921 unique songs in total
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["battles", "wins", "vol", "winPct"] as SortKey[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              style={{
                fontFamily: C.mono, fontSize: 11, padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                border: `1px solid ${sort === s ? C.accent : C.grid}`,
                background: sort === s ? C.accent : "transparent",
                color: sort === s ? "#1a1206" : C.dim,
                fontWeight: sort === s ? 600 : 400,
              }}
            >
              {s === "battles" ? "# battles" : s === "wins" ? "# wins" : s === "vol" ? "vol ◎" : "win %"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}`, color: C.dim, textAlign: "left" }}>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, width: 28 }}>#</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>SONG</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>B</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>W</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>L</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>WIN %</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>VOL ◎</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((s, i) => {
              const barW = Math.round((s.battles / maxBattles) * 100);
              const isChamp = i === 0 && sort === "battles";
              return (
                <tr key={s.title} style={{ borderBottom: `1px solid ${C.grid}22` }}>
                  <td style={{ padding: "5px 6px", color: C.dim, textAlign: "center" }}>{i + 1}</td>
                  <td style={{ padding: "5px 6px", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isChamp ? C.accent : C.text, fontWeight: isChamp ? 700 : 400 }}>
                    {s.title}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: sort === "battles" ? 700 : 400, color: sort === "battles" ? C.text : C.dim }}>{s.battles}</td>
                  <td style={{ padding: "5px 6px", textAlign: "center", color: C.accent, fontWeight: sort === "wins" ? 700 : 400 }}>{s.wins}</td>
                  <td style={{ padding: "5px 6px", textAlign: "center", color: C.dim }}>{s.losses}</td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: (s.winPct ?? 0) >= 70 ? C.accent : C.text, fontWeight: sort === "winPct" ? 700 : 400 }}>
                    {s.winPct != null ? `${s.winPct.toFixed(0)}%` : "—"}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: C.dim }}>{s.vol.toFixed(2)}</td>
                  <td style={{ padding: "5px 6px" }}>
                    <div style={{ height: 6, background: C.grid, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${barW}%`, height: "100%", background: `${C.accent}88`, borderRadius: 3 }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {songs.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 25)}
          style={{
            marginTop: 12, fontFamily: C.mono, fontSize: 12, padding: "6px 14px", borderRadius: 8,
            border: `1px solid ${C.grid}`, background: "transparent", color: C.dim, cursor: "pointer",
          }}
        >
          show more ({songs.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
