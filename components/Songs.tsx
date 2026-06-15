"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

interface Song {
  rank: number;
  song: string;
  artist: string;
  genre: string;
  heat: number;
  record: string;
  winPct: number;
  vol: number;
  audiusTrack?: string; // confirmed Audius track id (for inline player)
}

// Full chart from wavewarz.info/leaderboards/songs (37 songs, This Week).
// Snapshot 2026-06-15. Heat 0-100 (Hot 66+, Warm 33-65, Cool 0-32).
const SONGS: Song[] = [
  { rank: 1, song: "Fuck yo feelingZ", artist: "GodclouD", genre: "Electronic", heat: 100, record: "4W-0L", winPct: 100, vol: 1.98, audiusTrack: "0X6BQ99" },
  { rank: 2, song: "What the: Unreleased", artist: "BennyJ504WaveWarz", genre: "Hip-Hop/Rap", heat: 56, record: "0W-1L", winPct: 0, vol: 0.247, audiusTrack: "dY4Q23y" },
  { rank: 3, song: "EAZE OF MIND", artist: "GodclouD", genre: "Hip-Hop/Rap", heat: 38, record: "2W-0L", winPct: 100, vol: 0.31, audiusTrack: "mE6RMV5" },
  { rank: 4, song: "High Frequency with PKMN", artist: "RoCkY2GriMeY", genre: "R&B/Soul", heat: 33, record: "0W-1L", winPct: 0, vol: 0.022, audiusTrack: "mWpBmxQ" },
  { rank: 5, song: "ACCELERATE", artist: "_0xQuan", genre: "Hip-Hop/Rap", heat: 28, record: "0W-1L", winPct: 0, vol: 0.005 },
  { rank: 6, song: "Tr4cks", artist: "shawnsporter", genre: "Metal", heat: 23, record: "1W-0L", winPct: 100, vol: 0.296 },
  { rank: 7, song: "Trippy", artist: "shawnsporter", genre: "Electronic", heat: 23, record: "0W-1L", winPct: 0, vol: 0.0001 },
  { rank: 8, song: "Ride the Wave Warz", artist: "_0xQuan", genre: "Hip-Hop/Rap", heat: 20, record: "2W-0L", winPct: 100, vol: 0.254 },
  { rank: 9, song: "Independent Girl", artist: "Stormbourne", genre: "Country", heat: 16, record: "0W-2L", winPct: 0, vol: 0.057 },
  { rank: 10, song: "GM (Galactic Memories)", artist: "_0xQuan", genre: "Hip-Hop/Rap", heat: 15, record: "0W-1L", winPct: 0, vol: 0.008 },
  { rank: 11, song: "Gimme a break brother", artist: "geekmyth", genre: "Hip-Hop/Rap", heat: 12, record: "1W-1L", winPct: 50, vol: 0.153 },
  { rank: 12, song: "Money pose - Taji Kamikaze", artist: "CannonJones973", genre: "Hip-Hop/Rap", heat: 9, record: "0W-1L", winPct: 0, vol: 0.0001 },
  { rank: 13, song: "Svnd4y", artist: "shawnsporter", genre: "Metal", heat: 9, record: "0W-1L", winPct: 0, vol: 0.0098 },
  { rank: 14, song: "Repeating (Hardcore Break Mix)", artist: "shawnsporter", genre: "Drum & Bass", heat: 9, record: "1W-0L", winPct: 100, vol: 0.0493 },
  { rank: 15, song: "I Know This Kid", artist: "TuckNuisance", genre: "Hip-Hop/Rap", heat: 5, record: "0W-1L", winPct: 0, vol: 0.0098 },
  { rank: 16, song: "The Decay (Greasy Thoughts II)", artist: "AporkALYPSE78", genre: "Hip-Hop/Rap", heat: 5, record: "0W-1L", winPct: 0, vol: 0.0098 },
  { rank: 17, song: "Ashes", artist: "XTincT_official", genre: "Alternative", heat: 5, record: "1W-0L", winPct: 100, vol: 0.0197 },
  { rank: 18, song: "Bad Decisions", artist: "Stormbourne", genre: "Rock", heat: 5, record: "2W-0L", winPct: 100, vol: 0.0394 },
  { rank: 19, song: "Make Them Pay Freestyle", artist: "RoCkY2GriMeY", genre: "Hip-Hop/Rap", heat: 4, record: "0W-1L", winPct: 0, vol: 0.0493 },
  { rank: 20, song: "Locked In", artist: "geekmyth", genre: "Hip-Hop/Rap", heat: 3, record: "1W-0L", winPct: 100, vol: 0.0148 },
  { rank: 21, song: "Bonita", artist: "dopestilo", genre: "Latin", heat: 3, record: "0W-1L", winPct: 0, vol: 0.0098 },
  { rank: 22, song: "iF33L", artist: "shawnsporter", genre: "Alternative", heat: 3, record: "1W-0L", winPct: 100, vol: 0.0673 },
  { rank: 23, song: "Dead Already", artist: "PKMNCTO", genre: "Hip-Hop/Rap", heat: 3, record: "0W-1L", winPct: 0, vol: 0.013 },
  { rank: 24, song: "DownWavez x Hurric4n3Ike", artist: "Hurric4n3Ike", genre: "R&B/Soul", heat: 3, record: "1W-0L", winPct: 100, vol: 0.0197 },
  { rank: 25, song: "I'll Aim Guns At You", artist: "RoCkY2GriMeY", genre: "R&B/Soul", heat: 3, record: "0W-1L", winPct: 0, vol: 0.0049 },
  { rank: 26, song: "Its a Mood", artist: "luiwrites", genre: "Pop", heat: 3, record: "1W-1L", winPct: 50, vol: 0.0198 },
  { rank: 27, song: "I Don't Fit In", artist: "Stormbourne", genre: "Rock", heat: 2, record: "1W-0L", winPct: 100, vol: 0.0247 },
  { rank: 28, song: "Storm breaker - Taji Kamikaze", artist: "CannonJones973", genre: "Hip-Hop/Rap", heat: 2, record: "0W-1L", winPct: 0, vol: 0.0197 },
  { rank: 29, song: "Islands", artist: "Stormbourne", genre: "Pop", heat: 2, record: "0W-1L", winPct: 0, vol: 0.0098 },
  { rank: 30, song: "Rich Made", artist: "luiwrites", genre: "Hip-Hop/Rap", heat: 1, record: "1W-0L", winPct: 100, vol: 0.0098 },
  { rank: 31, song: "AI LUI - Goated City", artist: "luiwrites", genre: "Acoustic", heat: 1, record: "0W-1L", winPct: 0, vol: 0.005 },
  { rank: 32, song: "dazedream_demov2", artist: "XTincT_official", genre: "Hip-Hop/Rap", heat: 1, record: "1W-1L", winPct: 50, vol: 0.0099 },
  { rank: 33, song: "wondering_demov2", artist: "XTincT_official", genre: "Electronic", heat: 1, record: "1W-1L", winPct: 50, vol: 0.0053 },
  { rank: 34, song: "I Got It", artist: "AporkALYPSE78", genre: "Hip-Hop/Rap", heat: 1, record: "0W-1L", winPct: 0, vol: 0.005 },
  { rank: 35, song: "The Narrow Edge", artist: "AporkALYPSE78", genre: "Hip-Hop/Rap", heat: 1, record: "1W-0L", winPct: 100, vol: 0.0098 },
  { rank: 36, song: "Cipher Confession (LUI/STILO Diss PT. 1)", artist: "hoodrats", genre: "Hip-Hop/Rap", heat: 0, record: "1W-1L", winPct: 50, vol: 0.0 },
  { rank: 37, song: "BUGS BUNNY", artist: "luiwrites", genre: "Hip-Hop/Rap", heat: 0, record: "1W-1L", winPct: 50, vol: 0.0004 },
];

// Artists with a confirmed Audius profile - link the @handle to Audius, else X.
const AUDIUS_HANDLES = new Set([
  "GodclouD", "BennyJ504WaveWarz", "RoCkY2GriMeY", "shawnsporter", "Stormbourne",
  "geekmyth", "XTincT_official", "dopestilo", "PKMNCTO", "luiwrites",
  "AporkALYPSE78", "CannonJones973", "TuckNuisance", "hoodrats", "Hurric4n3Ike",
]);

const heatColor = (h: number) => (h >= 66 ? C.danger : h >= 33 ? C.accent : C.dim);
const fmt = (n: number) => (n ?? 0).toLocaleString();

export default function Songs() {
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hosts = await fetch("https://api.audius.co").then((r) => r.json());
        const host: string = hosts?.data?.[0] || "https://discoveryprovider.audius.co";
        const ids = SONGS.map((s) => s.audiusTrack).filter(Boolean) as string[];
        const res = await fetch(`${host}/v1/tracks?${ids.map((id) => `id=${id}`).join("&")}&app_name=wwtracker`).then((r) => r.json());
        const m: Record<string, number> = {};
        for (const t of res?.data ?? []) m[t.id] = t.play_count ?? 0;
        if (alive) setPlays(m);
      } catch {
        /* chart still renders */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / song charts</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          All <b>37 songs</b> on the WaveWarZ quick-battle charts - record, win %,
          SOL volume, and heat. Confirmed songs play inline from Audius.
        </p>
      </header>

      {SONGS[0]?.audiusTrack && (
        <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <span style={metaLabel}>#1 - NOW PLAYING</span>
          </div>
          <iframe title={SONGS[0].song} src={`https://audius.co/embed/track/${SONGS[0].audiusTrack}?flavor=compact`} width="100%" height={120} loading="lazy" allow="encrypted-media" style={{ border: "none", borderRadius: 8 }} />
        </section>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SONGS.map((s) => {
          const onAudius = AUDIUS_HANDLES.has(s.artist);
          const href = onAudius ? `https://audius.co/${s.artist}` : `https://x.com/${s.artist}`;
          return (
            <div key={s.rank} style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: C.mono, fontSize: 16, fontWeight: 800, color: C.accent, minWidth: 26 }}>{s.rank}</span>
                <div style={{ flex: 1, minWidth: 170 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{s.song}</div>
                  <a href={href} target="_blank" rel="noreferrer" style={{ color: C.dim, fontFamily: C.mono, fontSize: 12, textDecoration: "none" }}>
                    @{s.artist} - {s.genre} {onAudius ? "(Audius)" : ""} &#8599;
                  </a>
                </div>
                <div style={{ textAlign: "right", fontFamily: C.mono, fontSize: 12 }}>
                  <div style={{ color: heatColor(s.heat), fontWeight: 700 }}>{s.heat}/100</div>
                  <div style={{ color: C.dim }}>{s.record} ({s.winPct}%) - {s.vol} ◎</div>
                </div>
                {s.audiusTrack && (
                  <button type="button" onClick={() => setPlaying(playing === s.audiusTrack ? null : s.audiusTrack!)} style={{ background: "none", border: "none", color: C.accent, fontFamily: C.mono, fontSize: 12, cursor: "pointer", padding: 0 }}>
                    {playing === s.audiusTrack ? "close" : "play"}
                  </button>
                )}
              </div>
              <div style={{ marginTop: 8, height: 5, borderRadius: 999, background: C.bg, overflow: "hidden" }}>
                <div style={{ width: `${s.heat}%`, height: "100%", background: heatColor(s.heat) }} />
              </div>
              {s.audiusTrack && (
                <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginTop: 6 }}>
                  Audius: {plays[s.audiusTrack] != null ? `${fmt(plays[s.audiusTrack])} plays` : "..."}
                </div>
              )}
              {s.audiusTrack && playing === s.audiusTrack && (
                <iframe title={s.song} src={`https://audius.co/embed/track/${s.audiusTrack}?flavor=compact`} width="100%" height={120} loading="lazy" allow="encrypted-media" style={{ border: "none", borderRadius: 8, marginTop: 8 }} />
              )}
            </div>
          );
        })}
      </div>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Full 37-song chart from wavewarz.info (snapshot 2026-06-15). V2 judging:
        Poll + Charts (SOL) + DJ Wavy, 2 of 3. Play counts live from Audius.
      </p>
    </div>
  );
}
