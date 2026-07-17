"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = {
  id: string;
  a: string;
  b: string;
  aHandle?: string | null;
  bHandle?: string | null;
  winner: string;
};

interface Matchup {
  h1: string;
  h2: string;
  h1Wins: number;
  h2Wins: number;
  draws: number;
  total: number;
}

function computeMatchups(): Matchup[] {
  const battles = (battlesRaw as Battle[]).filter(
    (b) => b.aHandle && b.bHandle && b.aHandle !== b.bHandle,
  );

  const map = new Map<string, Matchup>();

  for (const b of battles) {
    const [h1, h2] = [b.aHandle!, b.bHandle!].sort();
    const key = `${h1}|${h2}`;
    if (!map.has(key)) map.set(key, { h1, h2, h1Wins: 0, h2Wins: 0, draws: 0, total: 0 });
    const m = map.get(key)!;
    m.total++;
    if (!b.winner || b.winner.trim() === "") {
      m.draws++;
      continue;
    }
    const h1Song = b.aHandle === h1 ? b.a : b.b;
    if (b.winner.trim() === h1Song.trim()) {
      m.h1Wins++;
    } else {
      m.h2Wins++;
    }
  }

  return [...map.values()]
    .filter((m) => m.total >= 2)
    .sort((a, b) => b.total - a.total || b.h1Wins + b.h2Wins - (a.h1Wins + a.h2Wins));
}

export default function HeadToHead() {
  const matchups = useMemo(computeMatchups, []);

  if (matchups.length === 0) return null;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>HEAD-TO-HEAD RIVALRIES</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          {matchups.length} matchups · 2+ battles · handle-tagged only
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 10,
        }}
      >
        {matchups.map((m) => (
          <MatchupCard key={`${m.h1}|${m.h2}`} matchup={m} />
        ))}
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
        self-battles excluded · only battles where both sides are handle-tagged count
      </p>
    </div>
  );
}

function MatchupCard({ matchup: m }: { matchup: Matchup }) {
  const decided = m.h1Wins + m.h2Wins;
  const h1Pct = decided > 0 ? (m.h1Wins / decided) * 100 : 50;
  const h2Pct = decided > 0 ? (m.h2Wins / decided) * 100 : 50;

  const h1Leading = m.h1Wins > m.h2Wins;
  const h2Leading = m.h2Wins > m.h1Wins;
  const tied = m.h1Wins === m.h2Wins;

  return (
    <div
      style={{
        background: C.bg,
        border: `1px solid ${C.grid}`,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Handles row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: C.mono,
            fontSize: 12,
            fontWeight: h1Leading ? 700 : 400,
            color: h1Leading ? C.accent : C.text,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.h1}
        </span>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, flex: "0 0 auto" }}>vs</span>
        <span
          style={{
            fontFamily: C.mono,
            fontSize: 12,
            fontWeight: h2Leading ? 700 : 400,
            color: h2Leading ? C.accent : C.text,
            flex: 1,
            textAlign: "right",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {m.h2}
        </span>
      </div>

      {/* Win bar */}
      <div
        style={{
          display: "flex",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          gap: 1,
        }}
      >
        <div
          style={{
            flex: h1Pct,
            background: h1Leading ? C.accent : C.dim,
            borderRadius: "3px 0 0 3px",
            opacity: h1Leading ? 1 : 0.5,
            transition: "flex 0.3s ease",
          }}
        />
        {m.draws > 0 && (
          <div style={{ flex: (m.draws / m.total) * 100, background: C.grid }} />
        )}
        <div
          style={{
            flex: h2Pct,
            background: h2Leading ? C.accent : C.dim,
            borderRadius: "0 3px 3px 0",
            opacity: h2Leading ? 1 : 0.5,
            transition: "flex 0.3s ease",
          }}
        />
      </div>

      {/* Score row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontFamily: C.mono,
            fontSize: 16,
            fontWeight: 700,
            color: h1Leading ? C.accent : C.text,
          }}
        >
          {m.h1Wins}
        </span>
        <span style={{ fontFamily: C.mono, fontSize: 10, color: C.dim, textAlign: "center" }}>
          {tied ? "TIED" : "—"}
          {"\n"}
          <span style={{ display: "block", fontSize: 9 }}>{m.total}W total</span>
        </span>
        <span
          style={{
            fontFamily: C.mono,
            fontSize: 16,
            fontWeight: 700,
            color: h2Leading ? C.accent : C.text,
          }}
        >
          {m.h2Wins}
        </span>
      </div>
    </div>
  );
}
