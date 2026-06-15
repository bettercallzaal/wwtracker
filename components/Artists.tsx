"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

const APP = "wwtracker";

// WaveWarZ artists with a CONFIRMED Audius profile (verified by handle/track
// match). _0xQuan had no confident Audius match, so it's left out.
const ARTISTS: { handle: string; audiusId: string; note: string }[] = [
  { handle: "GodclouD", audiusId: "Vg1rWzQ", note: '#1 song "Fuck yo feelingZ" (100/100 heat)' },
  { handle: "BennyJ504WaveWarz", audiusId: "RGyPJRg", note: '"What the: Unreleased"' },
  { handle: "RoCkY2GriMeY", audiusId: "aNYwwmo", note: '"High Frequency with PKMN"' },
];

interface Track {
  title: string;
  play_count: number;
  favorite_count: number;
  permalink: string;
  artwork?: { ["150x150"]?: string } | null;
}
interface AudiusUser {
  name: string;
  handle: string;
  follower_count: number;
  track_count: number;
  profile_picture?: { ["150x150"]?: string } | null;
}
interface Card {
  ww: (typeof ARTISTS)[number];
  user: AudiusUser | null;
  tracks: Track[];
}

const fmt = (n: number) => (n ?? 0).toLocaleString();

export default function Artists() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hosts = await fetch("https://api.audius.co").then((r) => r.json());
        const host: string = hosts?.data?.[0] || "https://discoveryprovider.audius.co";
        const out = await Promise.all(
          ARTISTS.map(async (a) => {
            try {
              const [u, t] = await Promise.all([
                fetch(`${host}/v1/users/${a.audiusId}?app_name=${APP}`).then((r) => r.json()),
                fetch(`${host}/v1/users/${a.audiusId}/tracks?app_name=${APP}&limit=5&sort=plays`).then((r) => r.json()),
              ]);
              return { ww: a, user: u?.data ?? null, tracks: (t?.data ?? []) as Track[] };
            } catch {
              return { ww: a, user: null, tracks: [] };
            }
          }),
        );
        if (alive) setCards(out);
      } catch {
        if (alive) setError("Could not reach Audius right now.");
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
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / artists</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          WaveWarZ artists with live stats from <b>Audius</b> - followers, tracks,
          and play counts, pulled fresh from the free Audius API.
        </p>
      </header>

      {error && (
        <p style={{ color: C.danger, fontFamily: C.mono, fontSize: 13 }}>{error}</p>
      )}

      {cards === null && !error ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ARTISTS.map((a) => (
            <div key={a.handle} className="skeleton-shimmer" style={{ height: 120, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(cards ?? []).map(({ ww, user, tracks }) => (
            <div key={ww.handle} style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {user?.profile_picture?.["150x150"] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profile_picture["150x150"]} alt={ww.handle} width={56} height={56} style={{ borderRadius: 12, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: C.elev }} />
                )}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <a href={`https://audius.co/${user?.handle ?? ww.handle}`} target="_blank" rel="noreferrer" style={{ fontSize: 17, fontWeight: 700, color: C.text, textDecoration: "none" }}>
                    {user?.name ?? ww.handle}
                  </a>
                  <div style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>@{user?.handle ?? ww.handle}</div>
                  <div style={{ fontFamily: C.mono, fontSize: 11, color: C.dim, marginTop: 2 }}>{ww.note}</div>
                </div>
                <div style={{ textAlign: "right", fontFamily: C.mono, fontSize: 12, color: C.text }}>
                  {user ? (
                    <>
                      <div><b style={{ color: C.accent }}>{fmt(user.follower_count)}</b> followers</div>
                      <div>{fmt(user.track_count)} tracks</div>
                    </>
                  ) : (
                    <span style={{ color: C.dim }}>Audius unavailable</span>
                  )}
                </div>
              </div>
              {tracks.length > 0 && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${C.grid}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {tracks.map((t) => (
                    <a key={t.permalink} href={`https://audius.co${t.permalink}`} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 12, color: C.text, textDecoration: "none", fontFamily: C.mono, fontSize: 12 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                      <span style={{ color: C.dim, flexShrink: 0 }}>{fmt(t.play_count)} plays - {fmt(t.favorite_count)} favs</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Live from the Audius API (api.audius.co). Only artists with a confirmed
        Audius match are shown. Not affiliated with Audius or WaveWarZ.
      </p>
    </div>
  );
}
