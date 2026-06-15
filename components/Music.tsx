"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C, metaLabel } from "@/lib/theme";

const APP = "wwtracker";
const ARTISTS: Record<string, string> = {
  Hurric4n3Ike: "lzq2G",
  GodclouD: "Vg1rWzQ",
  shawnsporter: "E7gJo",
  Stormbourne: "Wgq5qO0",
  luiwrites: "BJzwPMj",
  XTincT_official: "8043XGp",
  dopestilo: "6aW9G",
  CannonJones973: "mEjV46v",
  AporkALYPSE78: "XBBWXMa",
  geekmyth: "zZR8pvZ",
  PKMNCTO: "ZOOMN24",
  RoCkY2GriMeY: "aNYwwmo",
  BennyJ504WaveWarz: "RGyPJRg",
  TuckNuisance: "AM1VdZq",
  hoodrats: "wQKydRp",
  NDA_WaveWarz: "oGZ6o3J",
};

interface Track {
  id: string;
  title: string;
  play_count: number;
  favorite_count: number;
  repost_count: number;
  release_date?: string;
  genre?: string;
  permalink: string;
  artist: string;
}

const fmt = (n: number) => (n ?? 0).toLocaleString();

export default function Music() {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const hosts = await fetch("https://api.audius.co").then((r) => r.json());
        const host: string = hosts?.data?.[0] || "https://discoveryprovider.audius.co";
        const all: Track[] = [];
        await Promise.all(
          Object.entries(ARTISTS).map(async ([handle, id]) => {
            const r = await fetch(`${host}/v1/users/${id}/tracks?app_name=${APP}&limit=100`).then((x) => x.json());
            for (const t of r?.data ?? []) {
              all.push({
                id: t.id,
                title: t.title,
                play_count: t.play_count ?? 0,
                favorite_count: t.favorite_count ?? 0,
                repost_count: t.repost_count ?? 0,
                release_date: typeof t.release_date === "string" ? t.release_date.slice(0, 10) : undefined,
                genre: t.genre ?? "Unknown",
                permalink: t.permalink,
                artist: handle,
              });
            }
          }),
        );
        if (alive) setTracks(all);
      } catch {
        if (alive) setError("Could not reach Audius right now.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const agg = useMemo(() => {
    if (!tracks) return null;
    const plays = tracks.reduce((s, t) => s + t.play_count, 0);
    const favs = tracks.reduce((s, t) => s + t.favorite_count, 0);
    const genres = new Map<string, number>();
    for (const t of tracks) genres.set(t.genre || "Unknown", (genres.get(t.genre || "Unknown") ?? 0) + 1);
    const top = [...tracks].sort((a, b) => b.play_count - a.play_count).slice(0, 12);
    const reposted = [...tracks].sort((a, b) => b.repost_count - a.repost_count).slice(0, 6);
    const newest = [...tracks]
      .filter((t) => t.release_date)
      .sort((a, b) => (a.release_date! < b.release_date! ? 1 : -1))
      .slice(0, 6);
    const months = new Map<string, number>();
    for (const t of tracks) {
      if (!t.release_date) continue;
      const m = t.release_date.slice(0, 7);
      months.set(m, (months.get(m) ?? 0) + 1);
    }
    const byMonth = [...months.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, count]) => ({ month, count }));
    return {
      tracks: tracks.length,
      plays,
      favs,
      artists: Object.keys(ARTISTS).length,
      genres: [...genres.entries()].sort((a, b) => b[1] - a[1]),
      top,
      reposted,
      newest,
      byMonth,
    };
  }, [tracks]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header>
        <h1 style={{ margin: 0, fontSize: "clamp(22px, 5vw, 32px)", letterSpacing: "-0.02em" }}>
          WaveWarZ<span style={{ color: C.dim, fontWeight: 400 }}> / on Audius</span>
        </h1>
        <p style={{ margin: "8px 0 0", color: C.text, lineHeight: 1.6, maxWidth: 720 }}>
          The combined music footprint of WaveWarZ artists on Audius - live totals,
          genres, and the most-played tracks.
        </p>
      </header>

      {error && <p style={{ color: C.danger, fontFamily: C.mono, fontSize: 13 }}>{error}</p>}

      {!agg && !error ? (
        <div className="skeleton-shimmer" style={{ height: 300, borderRadius: 16 }} />
      ) : agg ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <Tile label="ARTISTS" value={fmt(agg.artists)} />
            <Tile label="TRACKS" value={fmt(agg.tracks)} />
            <Tile label="TOTAL PLAYS" value={fmt(agg.plays)} />
            <Tile label="TOTAL FAVS" value={fmt(agg.favs)} />
          </div>

          {agg.byMonth.length > 1 && (
            <Panel label="RELEASE ACTIVITY (TRACKS / MONTH)">
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agg.byMonth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={{ stroke: C.grid }} minTickGap={24} />
                    <YAxis tick={{ fill: C.dim, fontSize: 11, fontFamily: C.mono }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "rgba(255,194,75,0.08)" }} contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 10, fontFamily: C.mono, fontSize: 12 }} labelStyle={{ color: C.dim }} formatter={(v: number | string) => [v, "tracks"]} />
                    <Bar dataKey="count" fill={C.accent} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          <Panel label="GENRE BREAKDOWN">
            {agg.genres.map(([g, n]) => (
              <div key={g} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: C.mono, fontSize: 12, color: C.dim }}>
                  <span>{g}</span>
                  <span>{n} tracks</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: C.bg, overflow: "hidden", marginTop: 4 }}>
                  <div style={{ width: `${(n / agg.tracks) * 100}%`, height: "100%", background: C.accent }} />
                </div>
              </div>
            ))}
          </Panel>

          <Panel label="MOST-PLAYED TRACKS">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {agg.top.map((t, i) => (
                <div key={t.id}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", fontFamily: C.mono, fontSize: 12 }}>
                    <span style={{ color: C.accent, fontWeight: 700, minWidth: 20 }}>{i + 1}</span>
                    <a href={`https://audius.co${t.permalink}`} target="_blank" rel="noreferrer" style={{ color: C.text, textDecoration: "none", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title} <span style={{ color: C.dim }}>@{t.artist}</span>
                    </a>
                    <span style={{ color: C.dim, flexShrink: 0 }}>{fmt(t.play_count)} plays</span>
                    <button type="button" onClick={() => setPlaying(playing === t.id ? null : t.id)} style={{ background: "none", border: "none", color: C.accent, fontFamily: C.mono, fontSize: 12, cursor: "pointer", padding: 0, flexShrink: 0 }}>
                      {playing === t.id ? "close" : "play"}
                    </button>
                  </div>
                  {playing === t.id && (
                    <iframe title={t.title} src={`https://audius.co/embed/track/${t.id}?flavor=compact`} width="100%" height={120} loading="lazy" allow="encrypted-media" style={{ border: "none", borderRadius: 8, marginTop: 8 }} />
                  )}
                </div>
              ))}
            </div>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <Panel label="NEWEST RELEASES">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agg.newest.map((t) => (
                  <a key={t.id} href={`https://audius.co${t.permalink}`} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: C.mono, fontSize: 12, color: C.text, textDecoration: "none" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title} <span style={{ color: C.dim }}>@{t.artist}</span></span>
                    <span style={{ color: C.dim, flexShrink: 0 }}>{t.release_date}</span>
                  </a>
                ))}
              </div>
            </Panel>
            <Panel label="MOST REPOSTED">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agg.reposted.map((t) => (
                  <a key={t.id} href={`https://audius.co${t.permalink}`} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 10, fontFamily: C.mono, fontSize: 12, color: C.text, textDecoration: "none" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title} <span style={{ color: C.dim }}>@{t.artist}</span></span>
                    <span style={{ color: C.dim, flexShrink: 0 }}>{fmt(t.repost_count)} reposts</span>
                  </a>
                ))}
              </div>
            </Panel>
          </div>
        </>
      ) : null}

      <p style={{ ...metaLabel, fontSize: 11, lineHeight: 1.6 }}>
        Live from the Audius API across the 5 confirmed WaveWarZ artists. Not
        affiliated with Audius or WaveWarZ.
      </p>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...metaLabel, fontSize: 10 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 16, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span style={metaLabel}>{label}</span>
      </div>
      {children}
    </section>
  );
}
