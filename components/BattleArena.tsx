"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface Stat {
  handle: string;
  battles: number;
  wins: number;
  vol: number;
}

type Sort = "battles" | "wins" | "winpct" | "vol";

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

export default function BattleArena() {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [sort, setSort] = useState<Sort>("battles");

  useEffect(() => {
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then(
        (
          battles: {
            aHandle?: string;
            bHandle?: string;
            a?: string;
            b?: string;
            winner?: string;
            vol?: number;
          }[]
        ) => {
          const map: Record<string, Stat> = {};
          for (const b of battles) {
            for (const side of ["a", "b"] as const) {
              const h = (b[`${side}Handle`] ?? "").toLowerCase().trim();
              if (!h) continue;
              if (!map[h]) map[h] = { handle: h, battles: 0, wins: 0, vol: 0 };
              map[h].battles += 1;
              map[h].vol += b.vol ?? 0;
              if ((b.winner ?? "").trim() === (b[side] ?? "").trim())
                map[h].wins += 1;
            }
          }
          setStats(Object.values(map));
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

  const totalBattles = stats.reduce((s, x) => s + x.battles, 0) / 2;
  const totalVol = stats.reduce((s, x) => s + x.vol, 0) / 2;

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
          <span style={metaLabel}>BATTLE ARENA — ALL TYPES</span>
          <p style={{ margin: "6px 0 0", fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
            every handle ranked across quick, main, and community battles.
            computed from {Math.round(totalBattles).toLocaleString()} recorded battles · {fmt(totalVol, 1)} ◎ total volume.
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
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}` }}>
              {["#", "HANDLE", "BATTLES", "W", "L", "WIN %", "VOLUME ◎"].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      ...metaLabel,
                      fontSize: 10,
                      textAlign: h === "HANDLE" ? "left" : "right",
                      padding: "4px 10px 8px",
                      fontWeight: 700,
                    }}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const wr =
                s.battles > 0 ? Math.round((s.wins / s.battles) * 100) : 0;
              const losses = s.battles - s.wins;
              return (
                <tr
                  key={s.handle}
                  style={{
                    borderBottom: `1px solid ${C.grid}`,
                    opacity: 1,
                  }}
                >
                  <td
                    style={{
                      padding: "9px 10px",
                      color: C.dim,
                      fontSize: 11,
                      textAlign: "right",
                    }}
                  >
                    {i + 1}
                  </td>
                  <td style={{ padding: "9px 10px", textAlign: "left" }}>
                    <a
                      href={`/artist/${s.handle}`}
                      style={{ color: C.accent, textDecoration: "none" }}
                    >
                      @{s.handle}
                    </a>
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      textAlign: "right",
                      fontWeight: sort === "battles" ? 700 : 400,
                      color: sort === "battles" ? C.text : C.dim,
                    }}
                  >
                    {s.battles}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      textAlign: "right",
                      color: C.good,
                      fontWeight: sort === "wins" ? 700 : 400,
                    }}
                  >
                    {s.wins}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      textAlign: "right",
                      color: C.danger,
                    }}
                  >
                    {losses}
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
                      textAlign: "right",
                      color: wr >= 50 ? C.good : C.dim,
                      fontWeight: sort === "winpct" ? 700 : 400,
                    }}
                  >
                    {wr}%
                  </td>
                  <td
                    style={{
                      padding: "9px 10px",
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

      <p
        style={{
          ...metaLabel,
          fontSize: 10,
          marginTop: 14,
          lineHeight: 1.6,
        }}
      >
        source: /ww-battles.json · includes quick, main, and community battles · handles with no recorded battles not shown
      </p>
    </section>
  );
}
