"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface Battle {
  id: string;
  type: string;
  date: string;
  a: string;
  b: string;
  winner: string;
  vol: number;
  margin: number | null;
  aHandle?: string;
  bHandle?: string;
}

const MAX_BATTLES = 10;
const TYPE_COLOR: Record<string, string> = {
  MAIN: "#c9a0ff",
  QUICK: "#8ab4ff",
  COMMUNITY: "#7ef5b0",
};

export default function RecentBattlesFeed() {
  const [battles, setBattles] = useState<Battle[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((all: Battle[]) => {
        if (!alive) return;
        const recent = all.slice(0, MAX_BATTLES);
        setBattles(recent);
      })
      .catch(() => alive && setBattles([]));
    return () => { alive = false; };
  }, []);

  if (!battles || !battles.length) return null;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ ...metaLabel, fontSize: 11 }}>RECENT BATTLES</span>
        <a href="/?#battles" style={{ fontFamily: C.mono, fontSize: 11, color: C.accent, textDecoration: "none" }}>
          see all →
        </a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {battles.map((b) => {
          const aWon = b.winner === b.a;
          const typeCol = TYPE_COLOR[b.type] ?? C.accent;
          return (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 0",
                borderBottom: `1px solid ${C.grid}`,
                fontFamily: C.mono,
                fontSize: 12,
              }}
            >
              <span style={{ color: typeCol, fontSize: 10, fontWeight: 700, flexShrink: 0, minWidth: 42 }}>
                {b.type}
              </span>
              <span style={{ color: C.dim, fontSize: 10, flexShrink: 0, minWidth: 54 }}>
                {b.date.split(",")[0]}
              </span>
              <span
                style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: aWon ? 700 : 400, color: aWon ? C.good : C.text }}
                title={b.a}
              >
                {b.aHandle
                  ? <a href={`/artist/${b.aHandle.toLowerCase()}`} style={{ color: aWon ? C.good : C.accent, textDecoration: "none" }}>{b.a}</a>
                  : b.a}
              </span>
              <span style={{ color: C.dim, flexShrink: 0 }}>vs</span>
              <span
                style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: !aWon ? 700 : 400, color: !aWon ? C.good : C.text }}
                title={b.b}
              >
                {b.bHandle
                  ? <a href={`/artist/${b.bHandle.toLowerCase()}`} style={{ color: !aWon ? C.good : C.accent, textDecoration: "none" }}>{b.b}</a>
                  : b.b}
              </span>
              <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, flexShrink: 0 }}>
                {b.vol.toFixed(2)} ◎
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
