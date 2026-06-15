"use client";

import { useEffect, useState } from "react";
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
  // Confirmed Audius track (verified by handle + title match).
  audius?: { id: string; permalink: string };
}

// Verified from wavewarz.info song charts (top 5 of 37; snapshot 2026-06-14).
// Audius track ids/permalinks verified against each artist's catalog.
const SONGS: Song[] = [
  { rank: 1, song: "Fuck yo feelingZ", artist: "GodclouD", record: "4W-0L", winPct: 100, vol: 1.98, heat: 100, tier: "HOT", audius: { id: "0X6BQ99", permalink: "/GodclouD/fuck-yo-feelingz" } },
  { rank: 2, song: "What the: Unreleased", artist: "BennyJ504WaveWarz", record: "0W-1L", winPct: 0, vol: 0.247, heat: 54, tier: "WARM", audius: { id: "dY4Q23y", permalink: "/BennyJ504WaveWarz/what-the-unreleased" } },
  { rank: 3, song: "EAZE OF MIND", artist: "GodclouD", record: "2W-0L", winPct: 100, vol: 0.31, heat: 40, tier: "WARM", audius: { id: "mE6RMV5", permalink: "/GodclouD/eaze-of-mind" } },
  { rank: 4, song: "High Frequency with PKMN", artist: "RoCkY2GriMeY", record: "0W-1L", winPct: 0, vol: 0.022, heat: 36, tier: "WARM", audius: { id: "mWpBmxQ", permalink: "/RoCkY2GriMeY/high-frequency-with-pkmn" } },
  { rank: 5, song: "ACCELERATE", artist: "_0xQuan", record: "0W-1L", winPct: 0, vol: 0.005, heat: 31, tier: "COOL", genre: "Hip-Hop/Rap" },
];

const tierColor = (t: Song["tier"]) => (t === "HOT" ? C.danger : t === "WARM" ? C.accent : C.dim);
const fmt = (n: number) => (n ?? 0).toLocaleString();

interface AudiusStat {
  play_count: number;
  favorite_count: number;
  genre?: string;
  release_date?: string;
}

export default function Songs() {
  const [stats, setStats] = useState<Record<string, AudiusStat>>({});
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hosts = await fetch("https://api.audius.co").then((r) => r.json());
        const host: string = hosts?.data?.[0] || "https://discoveryprovider.audius.co";
        const ids = SONGS.map((s) => s.audius?.id).filter(Boolean) as string[];
        const qs = ids.map((id) => `id=${id}`).join("&");
        const res = await fetch(`${host}/v1/tracks?${qs}&app_name=wwtracker`).then((r) => r.json());
        const map: Record<string, AudiusStat> = {};
        for (const t of res?.data ?? []) {
          map[t.id] = {
            play_count: t.play_count ?? 0,
            favorite_count: t.favorite_count ?? 0,
            genre: t.genre ?? undefined,
            release_date: typeof t.release_date === "string" ? t.release_date.slice(0, 10) : undefined,
          };
        }
        if (alive) setStats(map);
      } catch {
        /* leave stats empty - chart data still renders */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / song charts</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          Top charting songs - WaveWarZ battle record + heat, fused with live
          Audius play counts and stream links.
        </p>
      </header>

      {/* featured player - the #1 charting song, playable inline */}
      {SONGS[0]?.audius && (
        <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <span style={metaLabel}>#1 SONG - NOW PLAYING</span>
          </div>
          <iframe
            title={SONGS[0].song}
            src={`https://audius.co/embed/track/${SONGS[0].audius.id}?flavor=compact`}
            width="100%"
            height={120}
            loading="lazy"
            allow="encrypted-media"
            style={{ border: "none", borderRadius: 8 }}
          />
        </section>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SONGS.map((s) => {
          const st = s.audius ? stats[s.audius.id] : undefined;
          return (
            <div key={s.rank} style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: C.mono, fontSize: 22, fontWeight: 800, color: C.accent, minWidth: 28 }}>{s.rank}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 17, fontWeight: 700 }}>{s.song}</div>
                  <a href={`https://x.com/${s.artist}`} target="_blank" rel="noreferrer" style={{ color: C.dim, fontFamily: C.mono, fontSize: 13, textDecoration: "none" }}>
                    @{s.artist} &#8599;
                  </a>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: C.mono, fontWeight: 700, color: tierColor(s.tier) }}>{s.heat}/100 {s.tier}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>{s.record} ({s.winPct}%) - {s.vol} ◎</div>
                </div>
              </div>
              <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: C.bg, overflow: "hidden" }}>
                <div style={{ width: `${s.heat}%`, height: "100%", background: tierColor(s.tier) }} />
              </div>
              {s.audius && (
                <>
                  <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: C.mono, fontSize: 12 }}>
                    <span style={{ color: C.dim }}>
                      Audius: {st ? `${fmt(st.play_count)} plays - ${fmt(st.favorite_count)} favs` : "loading..."}
                      {st?.genre ? ` - ${st.genre}` : ""}
                      {st?.release_date ? ` - ${st.release_date}` : ""}
                    </span>
                    <span style={{ display: "flex", gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => setPlaying(playing === s.audius!.id ? null : s.audius!.id)}
                        style={{ background: "none", border: "none", color: C.accent, fontFamily: C.mono, fontSize: 12, cursor: "pointer", padding: 0 }}
                      >
                        {playing === s.audius.id ? "close" : "play"}
                      </button>
                      <a href={`https://audius.co${s.audius.permalink}`} target="_blank" rel="noreferrer" style={{ color: C.accent, textDecoration: "none" }}>
                        Audius &#8599;
                      </a>
                    </span>
                  </div>
                  {playing === s.audius.id && (
                    <iframe
                      title={s.song}
                      src={`https://audius.co/embed/track/${s.audius.id}?flavor=compact`}
                      width="100%"
                      height={120}
                      loading="lazy"
                      allow="encrypted-media"
                      style={{ border: "none", borderRadius: 8, marginTop: 10 }}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Top 5 of 37 songs, chart stats from wavewarz.info; play counts live from
        Audius. The full roster loads client-side on wavewarz.info and is not
        publicly fetchable. Snapshot 2026-06-14.
      </p>
    </div>
  );
}
