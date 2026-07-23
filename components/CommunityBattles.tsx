"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import { BATTLE_STATS } from "@/lib/battles";
import battlesRaw from "@/public/ww-battles.json";

type Battle = {
  id?: string;
  date: string;
  type: string;
  a: string;
  b: string;
  winner: string;
  vol: number;
};

const battles = battlesRaw as Battle[];

function winnerLabel(b: Battle): string {
  if (!b.winner) return "—";
  const wt = b.winner.trim();
  if (wt === b.a.trim()) return b.a;
  if (wt === b.b.trim()) return b.b;
  return wt;
}

export default function CommunityBattles() {
  const rows = useMemo(() => {
    return [...battles.filter((b) => b.type === "COMMUNITY")].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, []);

  const totalVol = useMemo(() => rows.reduce((s, b) => s + (b.vol ?? 0), 0), [rows]);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>COMMUNITY BATTLES</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          ZAO-hosted special event battles — charity series, community tournaments, and platform showcases
        </p>
      </div>

      {/* Stat tiles */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <Tile label="ON-CHAIN BATTLES" value={BATTLE_STATS.communityBattles.toLocaleString()} sub={`per live API (${rows.length} in feed)`} />
        <Tile label="VOL GENERATED" value={`${totalVol.toFixed(2)} ◎`} sub="across all community events" />
        <Tile label="CHARITY RAISED" value="~$1,497" sub="PolyRaiders + Love Song series" />
        <Tile label="BENEFICIARY" value="HuRya" sub="HuRya Empowerment Foundation" />
      </div>

      {/* Charity note */}
      <div
        style={{
          background: `${C.accent}11`,
          border: `1px solid ${C.accent}33`,
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          fontFamily: C.mono,
          fontSize: 12,
          color: C.dim,
          lineHeight: 1.6,
        }}
      >
        <span style={{ color: C.accent, fontWeight: 700 }}>Charity series context: </span>
        The $1,497 raised came from two benefit battle series hosted before this tracker&apos;s
        data window — the <strong style={{ color: C.text }}>PolyRaiders Holiday Heat</strong> (Dec 2024) and the{" "}
        <strong style={{ color: C.text }}>Love Song Benefit</strong> (Feb 2025), both benefiting the{" "}
        <strong style={{ color: C.text }}>HuRya Empowerment Foundation</strong>. The community battles
        below are the full on-chain record of ZAO-hosted special events from May 2025 onward.
      </div>

      {/* Battle table */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}
        >
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}`, color: C.dim, textAlign: "left" }}>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>DATE</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>SONG A</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "center" }}>VS</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600 }}>SONG B</th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                VOL ◎
              </th>
              <th style={{ padding: "4px 6px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>WINNER</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b, i) => {
              const winner = winnerLabel(b);
              const aWon = winner === b.a;
              const bWon = winner === b.b;
              return (
                <tr
                  key={i}
                  style={{
                    borderBottom: `1px solid ${C.grid}22`,
                    background: i % 2 === 0 ? "transparent" : `${C.grid}08`,
                  }}
                >
                  <td
                    style={{
                      padding: "5px 6px",
                      color: C.dim,
                      whiteSpace: "nowrap",
                      fontSize: 11,
                    }}
                  >
                    {b.date}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: aWon ? C.accent : C.text,
                      fontWeight: aWon ? 700 : 400,
                    }}
                    title={b.a}
                  >
                    {b.a}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "center",
                      color: C.dim,
                      fontSize: 10,
                    }}
                  >
                    vs
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: bWon ? C.accent : C.text,
                      fontWeight: bWon ? 700 : 400,
                    }}
                    title={b.b}
                  >
                    {b.b}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      textAlign: "right",
                      color: C.dim,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {(b.vol ?? 0).toFixed(4)}
                  </td>
                  <td
                    style={{
                      padding: "5px 6px",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: C.accent,
                      fontWeight: 600,
                      fontSize: 11,
                    }}
                    title={winner}
                  >
                    {winner}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p
        style={{
          margin: "12px 0 0",
          color: C.dim,
          fontFamily: C.mono,
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        Data from ww-battles.json (on-chain record). Community battles start May 2025;
        earlier charity series (Dec 2024, Feb 2025) are not in this dataset.
      </p>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.grid}`,
        borderRadius: 10,
        padding: "10px 14px",
        minWidth: 140,
        flex: "1 1 140px",
      }}
    >
      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: C.mono, fontSize: 18, color: C.accent, fontWeight: 700 }}>{value}</div>
      <div style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, marginTop: 3 }}>{sub}</div>
    </div>
  );
}
