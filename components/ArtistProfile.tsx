"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = {
  id: string;
  date: string;
  type: string;
  a: string;
  b: string;
  aHandle: string;
  bHandle: string;
  winner: string;
  vol: number;
  margin: number;
};
const battles = battlesRaw as Battle[];

const ALL_HANDLES = Array.from(
  new Set(
    battles
      .filter((b) => b.aHandle && b.bHandle)
      .flatMap((b) => [b.aHandle, b.bHandle])
  )
).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

function winnerHandle(b: Battle): string | null {
  if (!b.winner) return null;
  const wt = b.winner.trim();
  if (b.a.trim() === wt) return b.aHandle;
  if (b.b.trim() === wt) return b.bHandle;
  return null;
}

type SortKey = "date" | "vol" | "result";

export default function ArtistProfile() {
  const [handle, setHandle] = useState("GodclouD");
  const [sort, setSort] = useState<SortKey>("date");

  const { bouts, wins, losses, totalVol, avgVol, biggestWin, topOpponent } = useMemo(() => {
    const bouts = battles.filter(
      (b) => (b.aHandle === handle || b.bHandle === handle) && b.aHandle && b.bHandle
    );
    let wins = 0, losses = 0;
    for (const b of bouts) {
      const w = winnerHandle(b);
      if (w === handle) wins++;
      else if (w) losses++;
    }
    const totalVol = bouts.reduce((s, b) => s + (b.vol ?? 0), 0);
    const avgVol = bouts.length > 0 ? totalVol / bouts.length : 0;

    const winBouts = bouts.filter((b) => winnerHandle(b) === handle);
    const biggestWin = winBouts.length > 0
      ? winBouts.reduce((best, b) => (b.vol > best.vol ? b : best))
      : null;

    // Top opponent by encounters
    const oppCount: Record<string, number> = {};
    for (const b of bouts) {
      const opp = b.aHandle === handle ? b.bHandle : b.aHandle;
      oppCount[opp] = (oppCount[opp] ?? 0) + 1;
    }
    const topOpponent = Object.entries(oppCount).sort((a, b) => b[1] - a[1])[0] ?? null;

    return { bouts, wins, losses, totalVol, avgVol, biggestWin, topOpponent };
  }, [handle]);

  const sorted = useMemo(() => {
    const copy = [...bouts];
    if (sort === "vol") return copy.sort((a, b) => (b.vol ?? 0) - (a.vol ?? 0));
    if (sort === "result") return copy.sort((a, b) => {
      const ra = winnerHandle(a) === handle ? 1 : winnerHandle(a) ? -1 : 0;
      const rb = winnerHandle(b) === handle ? 1 : winnerHandle(b) ? -1 : 0;
      return rb - ra;
    });
    // default: date desc
    return copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bouts, sort, handle]);

  const winPct = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : null;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <span style={metaLabel}>ARTIST PROFILE</span>

      {/* Handle selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          style={{
            fontFamily: C.mono, fontSize: 14, fontWeight: 700,
            background: C.panel, color: C.accent,
            border: `1px solid ${C.accent}`, borderRadius: 8, padding: "7px 12px",
            cursor: "pointer",
          }}
        >
          {ALL_HANDLES.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        {bouts.length > 0 && (
          <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>
            {bouts.length} battle{bouts.length !== 1 ? "s" : ""} on record
          </span>
        )}
      </div>

      {bouts.length === 0 && (
        <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          no handle-tagged battles for this artist in the current dataset.
        </p>
      )}

      {bouts.length > 0 && (
        <>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 16 }}>
            {[
              { label: "RECORD", value: `${wins}W / ${losses}L` },
              { label: "WIN %", value: winPct != null ? `${winPct.toFixed(0)}%` : "—" },
              { label: "TOTAL VOL", value: `${totalVol.toFixed(3)} ◎` },
              { label: "AVG VOL", value: `${avgVol.toFixed(3)} ◎` },
              ...(biggestWin ? [{ label: "BIGGEST WIN", value: `${biggestWin.vol.toFixed(3)} ◎` }] : []),
              ...(topOpponent ? [{ label: "TOP RIVAL", value: `${topOpponent[0]} (${topOpponent[1]}×)` }] : []),
            ].map((t) => (
              <div key={t.label} style={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, letterSpacing: "0.06em", marginBottom: 4 }}>{t.label}</div>
                <div style={{ fontFamily: C.mono, fontSize: 14, fontWeight: 700 }}>{t.value}</div>
              </div>
            ))}
          </div>

          {/* Sort controls + table */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["date", "vol", "result"] as SortKey[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                style={{
                  fontFamily: C.mono, fontSize: 11, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${sort === s ? C.accent : C.grid}`,
                  background: sort === s ? C.accent : "transparent",
                  color: sort === s ? "#1a1206" : C.dim,
                  fontWeight: sort === s ? 600 : 400,
                }}
              >
                {s === "date" ? "date ↓" : s === "vol" ? "vol ↓" : "wins first"}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.grid}`, color: C.dim, textAlign: "left" }}>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>DATE</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>MY SONG</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>VS SONG</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>OPP</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>VOL ◎</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>W/L</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => {
                  const mySong = b.aHandle === handle ? b.a : b.b;
                  const oppSong = b.aHandle === handle ? b.b : b.a;
                  const opp = b.aHandle === handle ? b.bHandle : b.aHandle;
                  const w = winnerHandle(b);
                  const won = w === handle;
                  const lost = w && w !== handle;
                  return (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${C.grid}22` }}>
                      <td style={{ padding: "5px 6px", color: C.dim, whiteSpace: "nowrap" }}>{b.date}</td>
                      <td style={{ padding: "5px 6px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: won ? C.accent : C.text, fontWeight: won ? 600 : 400 }}>
                        {mySong.trim()}
                      </td>
                      <td style={{ padding: "5px 6px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: lost ? C.accent : C.dim }}>
                        {oppSong.trim()}
                      </td>
                      <td style={{ padding: "5px 6px", color: C.dim, whiteSpace: "nowrap" }}>{opp}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right" }}>{(b.vol ?? 0).toFixed(3)}</td>
                      <td style={{ padding: "5px 6px", textAlign: "center", fontWeight: 700, color: won ? C.accent : lost ? C.dim : C.grid }}>
                        {won ? "W" : lost ? "L" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
