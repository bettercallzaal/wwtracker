"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { C, metaLabel } from "@/lib/theme";
import { AUDIUS_ID_BY_HANDLE, X_TO_AUDIUS_HANDLE, AUDIUS_TO_X_HANDLE } from "@/lib/artists";
import { songsByArtist } from "@/lib/songs";
import { LEADERBOARD } from "@/lib/leaderboard";

const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

interface AudiusUser { name: string; handle: string; follower_count: number; track_count: number; profile_picture?: { ["150x150"]?: string } | null; }
interface Track { id: string; title: string; play_count: number; permalink: string; }

export default function ArtistPage() {
  const params = useParams<{ handle: string }>();
  const handle = decodeURIComponent(params.handle || "");

  // Resolve Audius handle: handle may be an X/Twitter handle or an Audius handle.
  const audiusHandle = useMemo(() => {
    const lower = handle.toLowerCase();
    // Direct Audius handle match
    const direct = Object.keys(AUDIUS_ID_BY_HANDLE).find((h) => h.toLowerCase() === lower);
    if (direct) return direct;
    // X handle → Audius handle
    const mapped = Object.entries(X_TO_AUDIUS_HANDLE).find(([x]) => x.toLowerCase() === lower);
    return mapped ? mapped[1] : null;
  }, [handle]);

  const audiusId = audiusHandle ? (AUDIUS_ID_BY_HANDLE[audiusHandle] ?? null) : null;

  // Songs are keyed by Audius handle in lib/songs.ts
  const songs = useMemo(() => songsByArtist(audiusHandle ?? handle), [handle, audiusHandle]);

  // Leaderboard is keyed by X handle; handle might be an Audius handle (from Songs tab)
  const lb = useMemo(() => {
    const lower = handle.toLowerCase();
    const direct = LEADERBOARD.find((a) => a.handle.toLowerCase() === lower);
    if (direct) return direct;
    // handle was an Audius handle — find leaderboard entry via reverse map
    const xHandle = audiusHandle ? AUDIUS_TO_X_HANDLE[audiusHandle] : undefined;
    return xHandle ? LEADERBOARD.find((a) => a.handle.toLowerCase() === xHandle.toLowerCase()) ?? null : null;
  }, [handle, audiusHandle]);

  const [user, setUser] = useState<AudiusUser | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (!audiusId) return;
    let alive = true;
    (async () => {
      try {
        const hosts = await fetch("https://api.audius.co").then((r) => r.json());
        const host: string = hosts?.data?.[0] || "https://api.audius.co";
        const [u, t] = await Promise.all([
          fetch(`${host}/v1/users/${audiusId}?app_name=wwtracker`).then((r) => r.json()),
          fetch(`${host}/v1/users/${audiusId}/tracks?app_name=wwtracker&limit=8&sort=plays`).then((r) => r.json()),
        ]);
        if (alive) { setUser(u?.data ?? null); setTracks((t?.data ?? []) as Track[]); }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [audiusId]);

  return (
    <main style={{ minHeight: "100vh", padding: "clamp(16px,4vw,48px)", maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <a href="/?tab=artists" style={{ fontFamily: C.mono, fontSize: 12, color: C.accent, textDecoration: "none" }}>&#8592; back to wwtracker</a>

      <header style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {user?.profile_picture?.["150x150"] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.profile_picture["150x150"]} alt={handle} width={72} height={72} style={{ borderRadius: 14, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 72, height: 72, borderRadius: 14, background: C.elev }} />
        )}
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(22px,5vw,30px)" }}>{user?.name || handle}</h1>
          <div style={{ fontFamily: C.mono, fontSize: 13, color: C.dim }}>
            @{handle}{lb ? ` - leaderboard #${lb.rank}` : ""}
          </div>
        </div>
      </header>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
        {lb && <>
          <Tile label="MAIN-EVENT REC" value={lb.rec} />
          <Tile label="WIN %" value={`${lb.win}%`} />
          <Tile label="VOLUME" value={`${fmt(lb.vol)} ◎`} />
          <Tile label="EARNINGS" value={`${fmt(lb.earn, 3)} ◎`} />
        </>}
        {user && <>
          <Tile label="AUDIUS FOLLOWERS" value={fmt(user.follower_count, 0)} />
          <Tile label="AUDIUS TRACKS" value={fmt(user.track_count, 0)} />
        </>}
      </div>

      {/* charting songs */}
      {songs.length > 0 && (
        <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
          <span style={metaLabel}>CHARTING SONGS</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {songs.map((s) => (
              <div key={s.rank} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: C.mono, fontSize: 13, borderTop: `1px solid ${C.grid}`, paddingTop: 6 }}>
                <span>#{s.rank} {s.song} <span style={{ color: C.dim }}>- {s.genre}</span></span>
                <span style={{ color: C.dim, flexShrink: 0 }}>{s.record} - {s.heat}/100</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* audius top tracks with players */}
      {tracks.length > 0 && (
        <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
          <span style={metaLabel}>TOP TRACKS ON AUDIUS</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {tracks.slice(0, 4).map((t) => (
              <iframe key={t.id} title={t.title} src={`https://audius.co/embed/track/${t.id}?flavor=compact`} width="100%" height={120} loading="lazy" allow="encrypted-media" style={{ border: "none", borderRadius: 8 }} />
            ))}
          </div>
          <a href={`https://audius.co/${user?.handle || handle}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, color: C.accent, fontFamily: C.mono, fontSize: 12, textDecoration: "none" }}>
            full profile on Audius &#8599;
          </a>
        </section>
      )}

      {!lb && !user && songs.length === 0 && (
        <p style={{ fontFamily: C.mono, fontSize: 13, color: C.dim }}>No data found for @{handle}.</p>
      )}
    </main>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
