"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface SongStat {
  song: string;
  battles: number;
  wins: number;
  vol: number;
}

type Sort = "battles" | "wins" | "winpct" | "vol";

const MIN_BATTLES = 5;

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function SongArena() {
  const [stats, setStats] = useState<SongStat[] | null>(null);
  const [sort, setSort] = useState<Sort>("battles");

  useEffect(() => {
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then(
        (battles: { a?: string; b?: string; winner?: string; vol?: number }[]) => {
          const map: Record<string, SongStat> = {};
          for (const b of battles) {
            for (const side of ["a", "b"] as const) {
              const song = (b[side] ?? "").trim();
              if (!song) continue;
              if (!map[song])
                map[song] = { song, battles: 0, wins: 0, vol: 0 };
              map[song].battles += 1;
              map[song].vol += b.vol ?? 0;
              if ((b.winner ?? "").trim() === song) map[song].wins += 1;
            }
          }
          setStats(
            Object.values(map).filter((s) => s.battles >= MIN_BATTLES)
          );
        }
      )
      .catch(() => setStats([]));
  }, []);

  if (!stats) {
    return (
      <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 14 }} />
    );
  }
  if (stats.length === 0) return null;

  const sorted = [...stats].sort((a, b) => {
    if (sort === "battles") return b.battles - a.battles;
    if (sort === "wins") return b.wins - a.wins;
    if (sort === "winpct") {
      const ar = a.battles > 0 ? a.wins / a.battles : 0;
      const br = b.battles > 0 ? b.wins / b.battles : 0;
      return br - ar;
    }
    return b.vol - a.vol;
  });

  const SORTS: { key: Sort; label: string }[] = [
    { key: "battles", label: "BATTLES" },
    { key: "wins", label: "WINS" },
    { key: "winpct", label: "WIN %" },
    { key: "vol", label: "VOLUME" },
  ];

  return (
    <section
      style={{
        background: C.panel,
        border: `1px solid ${C.grid}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <span style={metaLabel}>SONG BATTLE RECORDS</span>
          <p
            style={{
              margin: "6px 0 0",
              fontFamily: C.mono,
              fontSize: 12,
              color: C.dim,
              lineHeight: 1.5,
            }}
          >
            {stats.length} songs with {MIN_BATTLES}+ battles ranked by performance.
            most-battled tracks in the WaveWarZ arena.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              style={{
                background: sort === s.key ? C.accent : C.elev,
                color: sort === s.key ? C.bg : C.dim,
                border: "none",
                borderRadius: 8,
                padding: "5px 10px",
                fontFamily: C.mono,
                fontSize: 11,
                fontWeight: sort === s.key ? 700 : 400,
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: C.mono,
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}` }}>
              {["#", "SONG", "BATTLES", "W", "L", "WIN %", "VOL ◎"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...metaLabel,
                    fontSize: 10,
                    textAlign: h === "SONG" ? "left" : "right",
                    padding: "4px 10px 8px",
                    fontWeight: 700,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, 50).map((s, i) => {
              const wr =
                s.battles > 0 ? Math.round((s.wins / s.battles) * 100) : 0;
              const losses = s.battles - s.wins;
              return (
                <tr key={s.song} style={{ borderBottom: `1px solid ${C.grid}` }}>
                  <td
                    style={{
                      padding: "8px 10px",
                      color: C.dim,
                      fontSize: 11,
                      textAlign: "right",
                    }}
                  >
                    {i + 1}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: C.text,
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={s.song}
                  >
                    {s.song}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      fontWeight: sort === "battles" ? 700 : 400,
                      color: sort === "battles" ? C.text : C.dim,
                    }}
                  >
                    {s.battles}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      color: C.good,
                      fontWeight: sort === "wins" ? 700 : 400,
                    }}
                  >
                    {s.wins}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      color: C.danger,
                    }}
                  >
                    {losses}
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      color: wr >= 60 ? C.good : wr >= 45 ? C.text : C.danger,
                      fontWeight: sort === "winpct" ? 700 : 400,
                    }}
                  >
                    {wr}%
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                      textAlign: "right",
                      color: C.accent,
                      fontWeight: sort === "vol" ? 700 : 400,
                    }}
                  >
                    {fmt(s.vol, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > 50 && (
        <p
          style={{ ...metaLabel, fontSize: 10, marginTop: 10, color: C.dim }}
        >
          showing top 50 of {sorted.length} qualifying songs
        </p>
      )}

      <p style={{ ...metaLabel, fontSize: 10, marginTop: 14, lineHeight: 1.6 }}>
        source: /ww-battles.json · songs with {MIN_BATTLES}+ battles shown ·
        win% ≥60% green, &lt;45% red · volume is sum of all battles this song appeared in
      </p>
    </section>
  );
}
