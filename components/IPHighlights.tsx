"use client";

import { useMemo } from "react";
import { C, metaLabel } from "@/lib/theme";
import battlesRaw from "@/public/ww-battles.json";

type Battle = { date: string; a: string; b: string; aHandle?: string; bHandle?: string; winner?: string; vol?: number };
const battles = battlesRaw as Battle[];

function parseMonth(date: string): string {
  const parts = date.split(" ");
  return parts.length >= 3 ? `${parts[0]} ${parts[2]}` : "";
}

function computeHighlights() {
  const songBattles: Record<string, { w: number; l: number; vol: number }> = {};
  const handleVol: Record<string, number> = {};
  const monthCount: Record<string, number> = {};

  for (const b of battles) {
    const vol = b.vol ?? 0;
    const m = parseMonth(b.date);
    if (m) monthCount[m] = (monthCount[m] ?? 0) + 1;

    for (const side of ["a", "b"] as const) {
      const song = b[side];
      if (!song) continue;
      if (!songBattles[song]) songBattles[song] = { w: 0, l: 0, vol: 0 };
      songBattles[song].vol += vol;
    }

    if (b.winner) {
      songBattles[b.winner] = songBattles[b.winner] ?? { w: 0, l: 0, vol: 0 };
      songBattles[b.winner].w++;
      const loser = b.winner === b.a ? b.b : b.a;
      if (loser) {
        songBattles[loser] = songBattles[loser] ?? { w: 0, l: 0, vol: 0 };
        songBattles[loser].l++;
      }
    }

    for (const h of [b.aHandle, b.bHandle]) {
      if (h) handleVol[h] = (handleVol[h] ?? 0) + vol;
    }
  }

  const mostBattled = Object.entries(songBattles)
    .map(([s, d]) => ({ song: s, count: d.w + d.l, winRate: d.w / Math.max(1, d.w + d.l) }))
    .sort((a, b) => b.count - a.count)[0];

  const mostDominant = Object.entries(songBattles)
    .map(([s, d]) => ({ song: s, count: d.w + d.l, winRate: d.w / Math.max(1, d.w + d.l), wins: d.w }))
    .filter((x) => x.count >= 10)
    .sort((a, b) => b.winRate - a.winRate)[0];

  const peakMonth = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0];

  const volumeChamp = Object.entries(handleVol).sort((a, b) => b[1] - a[1])[0];

  return { mostBattled, mostDominant, peakMonth, volumeChamp };
}

export default function IPHighlights() {
  const h = useMemo(computeHighlights, []);

  const cards = [
    {
      label: "MOST BATTLED TRACK",
      value: h.mostBattled?.song ?? "—",
      detail: h.mostBattled ? `${h.mostBattled.count} arena appearances` : "",
      sub: "highest battle count · all time",
    },
    {
      label: "MOST DOMINANT TRACK",
      value: h.mostDominant?.song ?? "—",
      detail: h.mostDominant
        ? `${Math.round(h.mostDominant.winRate * 100)}% win rate · ${h.mostDominant.count} battles`
        : "",
      sub: "best win rate · min 10 battles",
    },
    {
      label: "VOLUME CHAMPION",
      value: h.volumeChamp ? `@${h.volumeChamp[0]}` : "—",
      detail: h.volumeChamp ? `${h.volumeChamp[1].toFixed(2)} ◎ across their battles` : "",
      sub: "most SOL wagered on their matches",
    },
    {
      label: "PEAK MONTH",
      value: h.peakMonth?.[0] ?? "—",
      detail: h.peakMonth ? `${h.peakMonth[1]} battles in one month` : "",
      sub: "highest single-month battle count",
    },
  ];

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <span style={metaLabel}>ZAO IP — ARENA HIGHLIGHTS</span>
        <p style={{ margin: "4px 0 0", color: C.dim, fontFamily: C.mono, fontSize: 12 }}>
          the most extreme data points from 1,000+ battles — what the arena tells us about the music
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: C.bg,
              border: `1px solid ${C.grid}`,
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ ...metaLabel, fontSize: 10 }}>{c.label}</span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: C.accent,
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {c.value}
            </span>
            <span style={{ fontFamily: C.mono, fontSize: 12, color: C.text }}>{c.detail}</span>
            <span style={{ fontFamily: C.mono, fontSize: 11, color: C.dim }}>{c.sub}</span>
          </div>
        ))}
      </div>

      <p style={{ ...metaLabel, fontSize: 11, marginTop: 12, lineHeight: 1.6 }}>
        Computed live from ww-battles.json. Track win-rate requires min 10 battles to qualify.
        Volume champion counts both sides of a battle toward the artist&apos;s total — it reflects
        which artist&apos;s matches draw the most SOL, not individual earnings (see ArtistEarnings).
      </p>
    </div>
  );
}
