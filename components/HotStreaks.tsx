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
  vol: number;
};

const battles = (battlesRaw as Battle[]).slice().sort((a, b) => Number(a.id) - Number(b.id));

interface StreakRow {
  handle: string;
  current: number;
  max: number;
  totalBattles: number;
}

function computeStreaks(): StreakRow[] {
  const state = new Map<string, { current: number; max: number; total: number; lastWon: boolean | null }>();

  for (const b of battles) {
    for (const [handle, side] of [
      [b.aHandle, "a"],
      [b.bHandle, "b"],
    ] as [string | null | undefined, string][]) {
      if (!handle) continue;
      if (!state.has(handle)) {
        state.set(handle, { current: 0, max: 0, total: 0, lastWon: null });
      }
      const s = state.get(handle)!;
      s.total++;
      const mySong = side === "a" ? b.a : b.b;
      const won = !!b.winner && b.winner.trim() === mySong.trim();
      if (won) {
        s.current = s.lastWon === true ? s.current + 1 : 1;
        if (s.current > s.max) s.max = s.current;
        s.lastWon = true;
      } else {
        s.current = 0;
        s.lastWon = false;
      }
    }
  }

  return [...state.entries()]
    .filter(([, v]) => v.total >= 3)
    .map(([handle, v]) => ({
      handle,
      current: v.current,
      max: v.max,
      totalBattles: v.total,
    }));
}

export default function HotStreaks() {
  const streaks = useMemo(computeStreaks, []);

  const activeStreaks = useMemo(
    () => streaks.filter((r) => r.current >= 2).sort((a, b) => b.current - a.current).slice(0, 8),
    [streaks],
  );

  const recordStreaks = useMemo(
    () => streaks.slice().sort((a, b) => b.max - a.max).slice(0, 8),
    [streaks],
  );

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>HOT STREAKS</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          win streaks from tagged battles · handles tracked Jun 2026+
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.accent, letterSpacing: "0.08em", marginBottom: 8 }}>
            CURRENTLY HOT
          </div>
          {activeStreaks.length === 0 ? (
            <p style={{ color: C.dim, fontFamily: C.mono, fontSize: 12 }}>no active streaks ≥ 2</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {activeStreaks.map((r) => (
                <StreakBar key={r.handle} handle={r.handle} streak={r.current} max={activeStreaks[0].current} amber />
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, letterSpacing: "0.08em", marginBottom: 8 }}>
            RECORD STREAKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recordStreaks.map((r, i) => (
              <StreakBar key={r.handle} handle={r.handle} streak={r.max} max={recordStreaks[0].max} amber={i === 0} />
            ))}
          </div>
        </div>
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
        streaks reset on any loss · only handles tagged in the battle record count
      </p>
    </div>
  );
}

function StreakBar({ handle, streak, max, amber }: { handle: string; streak: number; max: number; amber: boolean }) {
  const pct = max > 0 ? (streak / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ position: "relative", flex: 1, height: 20, background: C.bg, borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${pct}%`,
            background: amber ? `${C.accent}44` : `${C.grid}`,
            borderRadius: 4,
            transition: "width 0.3s ease",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: C.mono,
            fontSize: 11,
            color: C.text,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "70%",
          }}
        >
          {handle}
        </span>
      </div>
      <span
        style={{
          fontFamily: C.mono,
          fontSize: 13,
          fontWeight: 700,
          color: amber ? C.accent : C.dim,
          minWidth: 24,
          textAlign: "right",
        }}
      >
        {streak}W
      </span>
    </div>
  );
}
