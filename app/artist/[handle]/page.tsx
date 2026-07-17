"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { C, metaLabel } from "@/lib/theme";
import { AUDIUS_ID_BY_HANDLE } from "@/lib/artists";
import { songsByArtist } from "@/lib/songs";
import { LEADERBOARD } from "@/lib/leaderboard";

interface RawBattle {
  id: string;
  type: string;
  date: string;
  a: string;
  b: string;
  aHandle: string;
  bHandle: string;
  winner: string;
  vol: number;
  margin: number;
}

interface ArtistBattle {
  id: string;
  type: string;
  date: string;
  song: string;
  opponentHandle: string;
  opponentSong: string;
  won: boolean;
  vol: number;
  margin: number;
}

const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

function computeStreak(battles: { won: boolean; date: string }[]): string {
  if (!battles.length) return "";
  const sorted = [...battles].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const first = sorted[0].won;
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].won === first) count++;
    else break;
  }
  return `${first ? "W" : "L"}${count}`;
}

interface AudiusUser { name: string; handle: string; follower_count: number; track_count: number; profile_picture?: { ["150x150"]?: string } | null; }
interface Track { id: string; title: string; play_count: number; permalink: string; }

export default function ArtistPage() {
  const params = useParams<{ handle: string }>();
  const handle = decodeURIComponent(params.handle || "");

  const audiusId = useMemo(() => {
    const k = Object.keys(AUDIUS_ID_BY_HANDLE).find((h) => h.toLowerCase() === handle.toLowerCase());
    return k ? AUDIUS_ID_BY_HANDLE[k] : null;
  }, [handle]);
  const songs = useMemo(() => {
    const k = Object.keys(AUDIUS_ID_BY_HANDLE).find((h) => h.toLowerCase() === handle.toLowerCase()) || handle;
    return songsByArtist(k);
  }, [handle]);
  const lb = useMemo(() => LEADERBOARD.find((a) => a.handle.toLowerCase() === handle.toLowerCase()), [handle]);

  const [user, setUser] = useState<AudiusUser | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [artistBattles, setArtistBattles] = useState<ArtistBattle[] | null>(null);
  const [showAllBattles, setShowAllBattles] = useState(false);

  const currentStreak = useMemo(() => {
    if (!artistBattles || !artistBattles.length) return "";
    return computeStreak(artistBattles.map((b) => ({ won: b.won, date: b.date })));
  }, [artistBattles]);

  useEffect(() => {
    if (!audiusId) return;
    let alive = true;
    (async () => {
      try {
        const hosts = await fetch("https://api.audius.co").then((r) => r.json());
        const host = hosts?.data?.[0] || "https://discoveryprovider.audius.co";
        const [u, t] = await Promise.all([
          fetch(`${host}/v1/users/${audiusId}?app_name=wwtracker`).then((r) => r.json()),
          fetch(`${host}/v1/users/${audiusId}/tracks?app_name=wwtracker&limit=8&sort=plays`).then((r) => r.json()),
        ]);
        if (alive) { setUser(u?.data ?? null); setTracks((t?.data ?? []) as Track[]); }
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [audiusId]);

  useEffect(() => {
    let alive = true;
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((all: RawBattle[]) => {
        if (!alive) return;
        const h = handle.toLowerCase();
        const filtered: ArtistBattle[] = all
          .filter((b) => b.aHandle?.toLowerCase() === h || b.bHandle?.toLowerCase() === h)
          .map((b) => {
            const isA = b.aHandle.toLowerCase() === h;
            return {
              id: b.id,
              type: b.type,
              date: b.date,
              song: isA ? b.a : b.b,
              opponentHandle: isA ? b.bHandle : b.aHandle,
              opponentSong: isA ? b.b : b.a,
              won: isA ? b.winner === b.a : b.winner === b.b,
              vol: b.vol,
              margin: b.margin,
            };
          });
        setArtistBattles(filtered);
      })
      .catch(() => alive && setArtistBattles([]));
    return () => { alive = false; };
  }, [handle]);

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
        {artistBattles && artistBattles.length > 0 && <>
          <Tile label="ALL-BATTLES RECORD" value={`${artistBattles.filter((b) => b.won).length}W–${artistBattles.filter((b) => !b.won).length}L`} />
          {currentStreak && (
            <Tile
              label="CURRENT STREAK"
              value={currentStreak}
              valueColor={currentStreak.startsWith("W") ? C.good : C.danger}
            />
          )}
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

      {/* battle history */}
      {artistBattles && artistBattles.length > 0 && (
        <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <span style={metaLabel}>BATTLE HISTORY ({artistBattles.length})</span>
            <span style={{ fontFamily: C.mono, fontSize: 12, color: C.dim }}>
              {artistBattles.filter((b) => b.won).length}W–{artistBattles.filter((b) => !b.won).length}L
              {" · "}{(artistBattles.filter((b) => b.won).length / artistBattles.length * 100).toFixed(0)}% WR
              {" · "}{artistBattles.reduce((s, b) => s + b.vol, 0).toFixed(2)} ◎
            </span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.mono, fontSize: 12 }}>
              <thead>
                <tr style={{ color: C.dim }}>
                  <th style={{ textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 400 }}>DATE</th>
                  <th style={{ textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 400 }}>TYPE</th>
                  <th style={{ textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 400 }}>MY SONG</th>
                  <th style={{ textAlign: "left", padding: "4px 8px 8px 0", fontWeight: 400 }}>VS</th>
                  <th style={{ textAlign: "right", padding: "4px 8px 8px 0", fontWeight: 400 }}>VOL</th>
                  <th style={{ textAlign: "right", padding: "4px 0 8px 8px", fontWeight: 400 }}>RESULT</th>
                </tr>
              </thead>
              <tbody>
                {(showAllBattles ? artistBattles : artistBattles.slice(0, 20)).map((b, i) => (
                  <tr key={b.id} style={{ borderTop: `1px solid ${C.grid}`, background: i % 2 ? "transparent" : `${C.elev}` }}>
                    <td style={{ padding: "6px 8px 6px 0", color: C.dim, whiteSpace: "nowrap" }}>{b.date}</td>
                    <td style={{ padding: "6px 8px 6px 0", color: C.dim }}>{b.type}</td>
                    <td style={{ padding: "6px 8px 6px 0", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.song}>{b.song}</td>
                    <td style={{ padding: "6px 8px 6px 0", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <a href={`/artist/${b.opponentHandle}`} style={{ color: C.accent, textDecoration: "none" }}>@{b.opponentHandle}</a>
                    </td>
                    <td style={{ padding: "6px 8px 6px 0", textAlign: "right" }}>{b.vol.toFixed(2)} ◎</td>
                    <td style={{ padding: "6px 0 6px 8px", textAlign: "right", fontWeight: 700, color: b.won ? C.good : C.danger }}>
                      {b.won ? "W" : "L"}
                      {b.margin > 0 && <span style={{ fontWeight: 400, color: C.dim, fontSize: 10 }}> +{b.margin}%</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {artistBattles.length > 20 && (
            <button
              type="button"
              onClick={() => setShowAllBattles((v) => !v)}
              style={{ marginTop: 10, fontFamily: C.mono, fontSize: 12, color: C.accent, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {showAllBattles ? "show fewer" : `show all ${artistBattles.length} battles`}
            </button>
          )}
        </section>
      )}

      {!lb && !user && songs.length === 0 && (!artistBattles || artistBattles.length === 0) && (
        <p style={{ fontFamily: C.mono, fontSize: 13, color: C.dim }}>No data found for @{handle}.</p>
      )}
    </main>
  );
}

function Tile({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: valueColor }}>{value}</span>
    </div>
  );
}
