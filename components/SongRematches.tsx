"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; a: string; b: string; winner: string; vol: number };
const battles = battlesRaw as Battle[];

type SortKey = "battles" | "vol" | "recent";

type Matchup = {
  a: string;
  b: string;
  total: number;
  aWins: number;
  bWins: number;
  draws: number;
  vol: number;
  lastDate: string;
};

export default function SongRematches() {
  const [sort, setSort] = useState<SortKey>("battles");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);

  const matchups = useMemo<Matchup[]>(() => {
    const acc: Record<string, Matchup> = {};
    for (const b of battles) {
      if (!b.a || !b.b) continue;
      const [sa, sb] = [b.a.trim(), b.b.trim()].sort();
      const key = sa + "|||" + sb;
      if (!acc[key]) {
        acc[key] = { a: sa, b: sb, total: 0, aWins: 0, bWins: 0, draws: 0, vol: 0, lastDate: b.date };
      }
      acc[key].total++;
      acc[key].vol += b.vol ?? 0;
      const nd = new Date(b.date);
      if (nd > new Date(acc[key].lastDate)) acc[key].lastDate = b.date;
      if (b.winner) {
        const w = b.winner.trim();
        if (w === sa) acc[key].aWins++;
        else if (w === sb) acc[key].bWins++;
        else acc[key].draws++;
      }
    }
    return Object.values(acc).filter((m) => m.total >= 2);
  }, []);

  const sorted = useMemo(() => {
    let list = [...matchups];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter((m) => m.a.toLowerCase().includes(q) || m.b.toLowerCase().includes(q));
    }
    if (sort === "vol") return list.sort((a, b) => b.vol - a.vol);
    if (sort === "recent") {
      return list.sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
    }
    return list.sort((a, b) => b.total - a.total || b.vol - a.vol);
  }, [matchups, sort, query]);

  const displayed = sorted.slice(0, limit);

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
          <span style={metaLabel}>SONG REMATCHES</span>
          <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
            {matchups.length} song pairings with 2+ battles · rematches reveal the true rivalries
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["battles", "vol", "recent"] as SortKey[]).map((s) => (
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
              {s === "battles" ? "most rematches" : s === "vol" ? "vol ◎" : "most recent"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search song title…"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setLimit(20); }}
        style={{
          width: "100%",
          fontFamily: C.mono,
          fontSize: 12,
          background: C.bg,
          border: `1px solid ${C.grid}`,
          borderRadius: 8,
          color: C.text,
          padding: "7px 12px",
          marginBottom: 14,
          boxSizing: "border-box",
          outline: "none",
        }}
      />

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}`, color: C.dim, textAlign: "left" }}>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>SONG A</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center", whiteSpace: "nowrap" }}>
                H2H
              </th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>SONG B</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>B</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                VOL ◎
              </th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                LAST
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((m, i) => {
              const aLeads = m.aWins > m.bWins;
              const bLeads = m.bWins > m.aWins;
              const sweep = m.aWins === m.total || m.bWins === m.total;
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.grid}22` }}>
                  <td
                    style={{
                      padding: "5px 6px",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: aLeads ? C.accent : C.text,
                      fontWeight: aLeads ? 700 : 400,
                    }}
                    title={m.a}
                  >
                    {m.a}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      fontWeight: 700,
                      color: sweep ? C.accent : C.text,
                    }}
                  >
                    {m.aWins}–{m.bWins}
                    {sweep && " ★"}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: bLeads ? C.accent : C.text,
                      fontWeight: bLeads ? 700 : 400,
                    }}
                    title={m.b}
                  >
                    {m.b}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "center",
                      color: m.total >= 3 ? C.accent : C.text,
                      fontWeight: m.total >= 3 ? 700 : 400,
                    }}
                  >
                    {m.total}
                  </td>
                  <td style={{ padding: "5px 6px", textAlign: "right", color: C.dim }}>
                    {m.vol.toFixed(3)}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "right",
                      color: C.dim,
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.lastDate}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((l) => l + 20)}
          style={{
            marginTop: 12,
            fontFamily: C.mono,
            fontSize: 12,
            padding: "6px 14px",
            borderRadius: 8,
            border: `1px solid ${C.grid}`,
            background: "transparent",
            color: C.dim,
            cursor: "pointer",
          }}
        >
          show more ({sorted.length - limit} remaining)
        </button>
      )}

      <p
        style={{
          margin: "12px 0 0",
          color: C.dim,
          fontFamily: C.mono,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        ★ = sweep (winner took all bouts). Amber = series leader. Songs sorted alphabetically to
        deduplicate; a song appearing on both sides of a matchup merges into one row.
      </p>
    </div>
  );
}
