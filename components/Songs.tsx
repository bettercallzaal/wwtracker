"use client";

import { C, metaLabel } from "@/lib/theme";

interface Song {
  rank: number;
  song: string;
  artist: string;
  record: string;
  winPct: number;
  vol: number;
  heat: number;
  tier: "HOT" | "WARM" | "COOL";
  genre?: string;
}

// Verified from wavewarz.info song charts (top 5 of 37; snapshot 2026-06-14).
const SONGS: Song[] = [
  { rank: 1, song: "Fuck yo feelingZ", artist: "GodclouD", record: "4W-0L", winPct: 100, vol: 1.98, heat: 100, tier: "HOT" },
  { rank: 2, song: "What the: Unreleased", artist: "BennyJ504WaveWarz", record: "0W-1L", winPct: 0, vol: 0.247, heat: 54, tier: "WARM" },
  { rank: 3, song: "EAZE OF MIND", artist: "GodclouD", record: "2W-0L", winPct: 100, vol: 0.31, heat: 40, tier: "WARM" },
  { rank: 4, song: "High Frequency with PKMN", artist: "RoCkY2GriMeY", record: "0W-1L", winPct: 0, vol: 0.022, heat: 36, tier: "WARM" },
  { rank: 5, song: "ACCELERATE", artist: "_0xQuan", record: "0W-1L", winPct: 0, vol: 0.005, heat: 31, tier: "COOL", genre: "Hip-Hop/Rap" },
];

const tierColor = (t: Song["tier"]) => (t === "HOT" ? C.danger : t === "WARM" ? C.accent : C.dim);

export default function Songs() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / song charts</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Top charting songs - record, SOL volume, and heat score (0-100). Heat
          blends volume, recency, and trader engagement.
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SONGS.map((s) => (
          <div key={s.rank} style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 800, color: C.accent, minWidth: 28 }}>
                {s.rank}
              </span>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{s.song}</div>
                <a href={`https://x.com/${s.artist}`} target="_blank" rel="noreferrer" style={{ color: C.dim, fontFamily: C.mono, fontSize: 13, textDecoration: "none" }}>
                  @{s.artist} &#8599;
                </a>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: C.mono, fontWeight: 700, color: tierColor(s.tier) }}>
                  {s.heat}/100 {s.tier}
                </div>
                <div style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>
                  {s.record} ({s.winPct}%) - {s.vol} ◎
                </div>
              </div>
            </div>
            {/* heat bar */}
            <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: C.bg, overflow: "hidden" }}>
              <div style={{ width: `${s.heat}%`, height: "100%", background: tierColor(s.tier) }} />
            </div>
          </div>
        ))}
      </div>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Top 5 of 37 songs, verified from wavewarz.info (the full roster loads
        client-side and is not publicly fetchable). Song titles shown as listed by
        the artists. Snapshot 2026-06-14.
      </p>
    </div>
  );
}
