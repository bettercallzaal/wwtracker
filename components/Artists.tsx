"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import { ROSTER as ARTISTS } from "@/lib/artists";

const APP = "wwtracker";

interface Track {
  id: string;
  title: string;
  play_count: number;
  favorite_count: number;
  permalink: string;
  genre?: string;
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

interface WwStat { battles: number; wins: number; vol: number; }

const fmt = (n: number) => (n ?? 0).toLocaleString();
const fmtSol = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Artists() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [host, setHost] = useState<string>("https://discoveryprovider.audius.co");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [full, setFull] = useState<Record<string, Track[]>>({});
  const [q, setQ] = useState("");
  const [wwStats, setWwStats] = useState<Record<string, WwStat> | null>(null);

  const expand = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!full[id]) {
      try {
        const r = await fetch("/api/audius/roster").then((x) => (x.ok ? x.json() : null));
        const hit = (r?.artists ?? []).find((a: { audiusId: string }) => a.audiusId === id);
        setFull((prev) => ({ ...prev, [id]: (hit?.tracks ?? []) as Track[] }));
      } catch {
        /* ignore */
      }
    }
  };

  useEffect(() => {
    fetch("/ww-battles.json")
      .then((r) => r.json())
      .then((battles: { aHandle?: string; bHandle?: string; a?: string; b?: string; winner?: string; vol?: number }[]) => {
        const map: Record<string, WwStat> = {};
        for (const b of battles) {
          for (const side of ["a", "b"] as const) {
            const h = (b[`${side}Handle`] ?? "").toLowerCase().trim();
            if (!h) continue;
            if (!map[h]) map[h] = { battles: 0, wins: 0, vol: 0 };
            map[h].battles += 1;
            map[h].vol += b.vol ?? 0;
            if ((b.winner ?? "").trim() === (b[side] ?? "").trim()) map[h].wins += 1;
          }
        }
        setWwStats(map);
      })
      .catch(() => setWwStats({}));
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/audius/roster")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (!j) {
          setError("Could not reach Audius right now.");
          return;
        }
        const byId = new Map<string, { user: AudiusUser | null; tracks: Track[] }>(
          (j.artists ?? []).map((a: { audiusId: string; user: AudiusUser | null; tracks: Track[] }) => [
            a.audiusId,
            { user: a.user, tracks: a.tracks ?? [] },
          ]),
        );
        // The roster order is ours, not the API's, so map over ARTISTS rather
        // than over the response.
        setCards(
          ARTISTS.map((a) => {
            const hit = byId.get(a.audiusId);
            return { ww: a, user: hit?.user ?? null, tracks: (hit?.tracks ?? []).slice(0, 5) };
          }),
        );
        if (j.reachable === false) setError("Could not reach Audius right now.");
      })
      .catch(() => alive && setError("Could not reach Audius right now."));
    return () => {
      alive = false;
    };
  }, []);

  const query = q.trim().toLowerCase();
  const visible = (cards ?? []).filter(
    (c) =>
      !query ||
      `${c.ww.handle} ${c.user?.name ?? ""} ${c.user?.handle ?? ""}`
        .toLowerCase()
        .includes(query)
  );

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

      {cards && cards.some((c) => c.user) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {(() => {
            const live = cards.filter((c) => c.user);
            const followers = live.reduce((s, c) => s + (c.user?.follower_count ?? 0), 0);
            const tracks = live.reduce((s, c) => s + (c.user?.track_count ?? 0), 0);
            return (
              <>
                <Foot label="ARTISTS ON AUDIUS" value={fmt(live.length)} />
                <Foot label="COMBINED FOLLOWERS" value={fmt(followers)} />
                <Foot label="COMBINED TRACKS" value={fmt(tracks)} />
              </>
            );
          })()}
        </div>
      )}

      {cards === null && !error ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ARTISTS.map((a) => (
            <div key={a.handle} className="skeleton-shimmer" style={{ height: 120, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="filter artists by name or handle"
            aria-label="Filter artists"
            style={{ fontFamily: C.mono, fontSize: 13, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.grid}`, background: C.bg, color: C.text }}
          />
          {visible.length === 0 && (
            <p style={{ ...metaLabel, fontSize: 12 }}>no artists match &quot;{q}&quot;.</p>
          )}
          {/* Two columns where there is room. Stacked one per row this section
              measured 12,261px - thirty-five percent of the whole page - while
              leaving half the viewport empty. The cards are text-dense but read
              fine at ~600px, and auto-fit collapses back to one column on
              anything narrow. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))",
              gap: 12,
              alignItems: "start",
            }}
          >
          {visible.map(({ ww, user, tracks }) => (
            <div key={ww.handle} style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {user?.profile_picture?.["150x150"] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profile_picture["150x150"]} alt={ww.handle} width={56} height={56} style={{ borderRadius: 12, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 12, background: C.elev }} />
                )}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <a href={`/artist/${ww.handle}`} style={{ fontSize: 17, fontWeight: 700, color: C.text, textDecoration: "none" }}>
                    {user?.name ?? ww.handle} &#8594;
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
              {wwStats && wwStats[ww.handle.toLowerCase()] && (() => {
                const ws = wwStats[ww.handle.toLowerCase()];
                const wr = ws.battles > 0 ? Math.round(ws.wins / ws.battles * 100) : 0;
                return (
                  <div style={{ marginTop: 10, fontFamily: C.mono, fontSize: 11, color: C.dim, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>WW: <b style={{ color: C.text }}>{ws.battles}</b> battles</span>
                    <span><b style={{ color: wr >= 50 ? C.good : C.text }}>{ws.wins}W</b> ({wr}%)</span>
                    <span><b style={{ color: C.accent }}>{fmtSol(ws.vol)} ◎</b> volume</span>
                  </div>
                );
              })()}
              {tracks.length > 0 && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${C.grid}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {(expanded === ww.audiusId && full[ww.audiusId] ? full[ww.audiusId]! : tracks).map((t) => (
                    <div key={t.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontFamily: C.mono, fontSize: 12, alignItems: "center" }}>
                        <a href={`https://audius.co${t.permalink}`} target="_blank" rel="noreferrer" style={{ color: C.text, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          {t.title}
                        </a>
                        <span style={{ color: C.dim, flexShrink: 0 }}>{fmt(t.play_count)} plays</span>
                        <button
                          type="button"
                          onClick={() => setPlaying(playing === t.id ? null : t.id)}
                          style={{ background: "none", border: "none", color: C.accent, fontFamily: C.mono, fontSize: 12, cursor: "pointer", padding: 0, flexShrink: 0 }}
                        >
                          {playing === t.id ? "close" : "play"}
                        </button>
                      </div>
                      {playing === t.id && (
                        <iframe
                          title={t.title}
                          src={`https://audius.co/embed/track/${t.id}?flavor=compact`}
                          width="100%"
                          height={120}
                          loading="lazy"
                          allow="encrypted-media"
                          style={{ border: "none", borderRadius: 8, marginTop: 8 }}
                        />
                      )}
                    </div>
                  ))}
                  {user && user.track_count > 5 && (
                    <button
                      type="button"
                      onClick={() => expand(ww.audiusId)}
                      style={{ marginTop: 4, alignSelf: "flex-start", background: "none", border: "none", color: C.accent, fontFamily: C.mono, fontSize: 12, cursor: "pointer", padding: 0 }}
                    >
                      {expanded === ww.audiusId ? "show less" : `show all ${user.track_count} tracks`}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      )}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Live from the Audius API (api.audius.co). Only artists with a confirmed
        Audius match are shown. Not affiliated with Audius or WaveWarZ.
      </p>
    </div>
  );
}

function Foot({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
