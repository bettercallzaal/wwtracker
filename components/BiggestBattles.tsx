"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface RawBattle {
  id: string;
  type: string;
  date: string;
  a: string;
  b: string;
  aHandle?: string;
  bHandle?: string;
  winner: string;
  vol: number;
  margin: number | null;
}

const TOP_N = 25;
const TYPE_COLOR: Record<string, string> = {
  MAIN: "#c9a0ff",
  QUICK: "#8ab4ff",
  COMMUNITY: "#7ef5b0",
};

export default function BiggestBattles() {
  const [battles, setBattles] = useState<RawBattle[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((all: RawBattle[]) => {
        if (!alive) return;
        const top = [...all]
          .filter((b) => b.vol > 0)
          .sort((a, b) => b.vol - a.vol)
          .slice(0, TOP_N);
        setBattles(top);
      })
      .catch(() => alive && setBattles([]));
    return () => { alive = false; };
  }, []);

  if (!battles) {
    return <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 14 }} />;
  }
  if (!battles.length) return null;

  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 20, marginTop: 12 }}>
      <div style={{ marginBottom: 16 }}>
        <span style={metaLabel}>BIGGEST BATTLES — TOP {TOP_N} BY VOLUME</span>
        <p style={{ margin: "6px 0 0", fontFamily: C.mono, fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
          the highest-stakes individual battles on record · MAIN events dominate the top · volume includes both sides of trading
        </p>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.grid}` }}>
              {["#", "DATE", "TYPE", "SONG A", "VS", "SONG B", "WINNER", "VOL ◎", "MARGIN"].map((h) => (
                <th
                  key={h}
                  style={{
                    ...metaLabel,
                    fontSize: 10,
                    textAlign: ["#", "VOL ◎", "MARGIN"].includes(h) ? "right" : h === "VS" ? "center" : "left",
                    padding: "4px 8px 8px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {battles.map((b, i) => {
              const aWon = b.winner === b.a;
              return (
                <tr key={b.id} style={{ borderBottom: `1px solid ${C.grid}`, background: i % 2 ? "transparent" : `${C.elev}` }}>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: C.dim, fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: "7px 8px", color: C.dim, whiteSpace: "nowrap" }}>{b.date}</td>
                  <td style={{ padding: "7px 8px" }}>
                    <span style={{
                      background: `${TYPE_COLOR[b.type] ?? C.accent}22`,
                      color: TYPE_COLOR[b.type] ?? C.accent,
                      borderRadius: 4,
                      padding: "2px 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                    }}>
                      {b.type}
                    </span>
                  </td>
                  <td style={{ padding: "7px 8px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: aWon ? 700 : 400, color: aWon ? C.good : C.text }} title={b.a}>
                    {b.aHandle
                      ? <a href={`/artist/${b.aHandle.toLowerCase()}`} style={{ color: aWon ? C.good : C.accent, textDecoration: "none" }}>{b.a}</a>
                      : b.a}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "center", color: C.dim, fontSize: 11 }}>vs</td>
                  <td style={{ padding: "7px 8px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: !aWon ? 700 : 400, color: !aWon ? C.good : C.text }} title={b.b}>
                    {b.bHandle
                      ? <a href={`/artist/${b.bHandle.toLowerCase()}`} style={{ color: !aWon ? C.good : C.accent, textDecoration: "none" }}>{b.b}</a>
                      : b.b}
                  </td>
                  <td style={{ padding: "7px 8px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.dim }} title={b.winner}>
                    ✓ {b.winner.length > 22 ? b.winner.slice(0, 22) + "…" : b.winner}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: 700, color: C.accent }}>
                    {b.vol.toFixed(2)}
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right", color: C.dim }}>
                    {b.margin != null ? `${b.margin}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ ...metaLabel, fontSize: 10, marginTop: 12 }}>
        source: /ww-battles.json · margin unavailable for older MAIN battles · winner shown with ✓
      </p>
    </section>
  );
}
