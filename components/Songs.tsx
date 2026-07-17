"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { SONGS } from "@/lib/songs";
import { AUDIUS_HANDLES } from "@/lib/artists";
import { DATA_AS_OF } from "@/lib/freshness";

const heatColor = (h: number) => (h >= 66 ? C.danger : h >= 33 ? C.accent : C.dim);
const fmt = (n: number) => (n ?? 0).toLocaleString();

export default function Songs() {
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const filtered = query
    ? SONGS.filter((s) =>
        `${s.song} ${s.artist} ${s.genre}`.toLowerCase().includes(query)
      )
    : SONGS;

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

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="filter by song, artist, or genre"
        style={{
          background: C.bg,
          border: `1px solid ${C.grid}`,
          color: C.text,
          borderRadius: 8,
          padding: "9px 12px",
          fontFamily: C.mono,
          fontSize: 13,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <p style={{ ...metaLabel, fontSize: 12 }}>no songs match &quot;{q}&quot;.</p>
        )}
        {filtered.map((s) => {
          const onAudius = AUDIUS_HANDLES.has(s.artist);
          const href = onAudius ? `/artist/${s.artist}` : `https://x.com/${s.artist}`;
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
        Full {SONGS.length}-song chart from wavewarz.info (snapshot {DATA_AS_OF}). V2 judging:
        Poll + Charts (SOL) + DJ Wavy, 2 of 3. Play counts live from Audius.
      </p>
    </div>
  );
}
