"use client";

import { useMemo, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { id: string; date: string; type: string; a: string; b: string; aHandle: string; bHandle: string; winner: string; vol: number; margin: number };
const battles = battlesRaw as Battle[];

// All handles that appear in at least one handle-populated battle
const ALL_HANDLES = Array.from(
  new Set(
    battles
      .filter((b) => b.aHandle && b.bHandle)
      .flatMap((b) => [b.aHandle, b.bHandle])
  )
).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

// Default: most-battled rivalry
const DEFAULT_A = "GodclouD";
const DEFAULT_B = "RoCkY2GriMeY";

function winnerHandle(b: Battle): string | null {
  if (!b.winner) return null;
  const wt = b.winner.trim();
  if (b.a.trim() === wt) return b.aHandle;
  if (b.b.trim() === wt) return b.bHandle;
  return null;
}

export default function HandleH2H() {
  const [hA, setHa] = useState(DEFAULT_A);
  const [hB, setHb] = useState(DEFAULT_B);
  const [swapped, setSwapped] = useState(false);

  const left = swapped ? hB : hA;
  const right = swapped ? hA : hB;

  const { bouts, wL, wR, volL, volR, volTotal, noResult } = useMemo(() => {
    const h2h = battles.filter(
      (b) =>
        b.aHandle &&
        b.bHandle &&
        ((b.aHandle === left && b.bHandle === right) ||
          (b.aHandle === right && b.bHandle === left))
    );
    let wL = 0, wR = 0, noResult = 0, volL = 0, volR = 0;
    for (const b of h2h) {
      const w = winnerHandle(b);
      if (w === left) { wL++; volL += b.vol ?? 0; }
      else if (w === right) { wR++; volR += b.vol ?? 0; }
      else noResult++;
    }
    return { bouts: h2h, wL, wR, volL, volR, volTotal: (volL + volR), noResult };
  }, [left, right]);

  const sameHandle = hA === hB;

  function sel(which: "a" | "b") {
    return (
      <select
        value={which === "a" ? hA : hB}
        onChange={(e) => (which === "a" ? setHa : setHb)(e.target.value)}
        style={{
          fontFamily: C.mono, fontSize: 13, fontWeight: 600,
          background: C.panel, color: C.text,
          border: `1px solid ${C.grid}`, borderRadius: 8, padding: "6px 10px",
          cursor: "pointer", maxWidth: 180,
        }}
      >
        {ALL_HANDLES.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    );
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <span style={metaLabel}>HEAD-TO-HEAD LOOKUP</span>

      {/* Picker row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        {sel("a")}
        <button
          type="button"
          title="Swap sides"
          onClick={() => setSwapped((s) => !s)}
          style={{
            fontFamily: C.mono, fontSize: 14, padding: "6px 10px", borderRadius: 8, cursor: "pointer",
            border: `1px solid ${C.grid}`, background: "transparent", color: C.dim,
          }}
        >
          ⇄
        </button>
        {sel("b")}
      </div>

      {sameHandle && (
        <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 12, marginTop: 12 }}>
          pick two different handles to see their record.
        </p>
      )}

      {!sameHandle && bouts.length === 0 && (
        <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 12, marginTop: 12 }}>
          no battles between these two handles in the current dataset.
        </p>
      )}

      {!sameHandle && bouts.length > 0 && (
        <>
          {/* Score bar */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.accent }}>{left}</span>
              <span style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: C.dim }}>{right}</span>
            </div>
            <div style={{ position: "relative", height: 28, background: C.bg, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.grid}` }}>
              {bouts.length > 0 && (
                <div
                  style={{
                    position: "absolute", left: 0, top: 0, height: "100%",
                    width: `${(wL / (wL + wR || 1)) * 100}%`,
                    background: C.accent, transition: "width 0.3s ease",
                  }}
                />
              )}
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: wL > wR ? "#1a1206" : C.text,
              }}>
                {wL} – {wR}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>{volL.toFixed(3)} ◎</span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>
                {bouts.length} bout{bouts.length !== 1 ? "s" : ""} · {volTotal.toFixed(3)} ◎ total
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>{volR.toFixed(3)} ◎</span>
            </div>
          </div>

          {/* Bout log */}
          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.grid}`, color: C.dim, textAlign: "left" }}>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>DATE</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>SONG A ({left})</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>SONG B ({right})</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>VOL ◎</th>
                  <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right" }}>W</th>
                </tr>
              </thead>
              <tbody>
                {bouts.map((b) => {
                  const lSong = b.aHandle === left ? b.a : b.b;
                  const rSong = b.aHandle === right ? b.a : b.b;
                  const w = winnerHandle(b);
                  const lWon = w === left;
                  const rWon = w === right;
                  return (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${C.grid}22` }}>
                      <td style={{ padding: "5px 6px", color: C.dim, whiteSpace: "nowrap" }}>{b.date}</td>
                      <td style={{ padding: "5px 6px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: lWon ? C.accent : C.text, fontWeight: lWon ? 600 : 400 }}>
                        {lSong.trim()}
                      </td>
                      <td style={{ padding: "5px 6px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: rWon ? C.accent : C.text, fontWeight: rWon ? 600 : 400 }}>
                        {rSong.trim()}
                      </td>
                      <td style={{ padding: "5px 6px", textAlign: "right", color: C.dim }}>{(b.vol ?? 0).toFixed(3)}</td>
                      <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 700, color: lWon ? C.accent : rWon ? C.dim : C.grid }}>
                        {lWon ? left : rWon ? right : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {noResult > 0 && (
            <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 11, marginTop: 8 }}>
              {noResult} bout{noResult !== 1 ? "s" : ""} with no recorded outcome.
            </p>
          )}
        </>
      )}
    </div>
  );
}
