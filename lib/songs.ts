"use client";

// Song data is live via /api/ww/leaderboards/songs (the cached fan-out over
// wavewarz.info's public API). The old baked SONGS array is gone: it held 37
// rows against the API's 934, so it was showing four percent of the catalogue.
//
// What replaced it needed care. The per-artist view used to work by matching a
// baked `artist` field to an Audius handle, and the live API has no such field -
// it has `artistName`, a display name ("GodclouD"), which does not reliably
// equal the handle ("therealgodcloud"). Matching those two by string would drop
// songs silently and look like the artist simply has none.
//
// The reliable join is the permalink: `musicLink` is
// https://audius.co/<handle>/<track-slug>, so the first path segment IS the
// Audius handle, exactly. That is what this matches on.

import { useEffect, useMemo, useState } from "react";
import type { SongLeaderboardEntry } from "./wavewarzApi";

export interface Song {
  rank: number;
  song: string;
  artist: string;
  genre: string;
  record: string;
  winPct: number;
  vol: number;
  traders: number;
  lastPlayed: string | null;
  musicLink: string | null;
}

/** Audius handle out of a permalink, or null for a non-Audius link. */
export function audiusHandleFromLink(link: string | null | undefined): string | null {
  const raw = (link ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!u.hostname.endsWith("audius.co")) return null;
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg ? decodeURIComponent(seg) : null;
  } catch {
    return null;
  }
}

function toSong(s: SongLeaderboardEntry, i: number): Song {
  return {
    rank: i + 1,
    song: (s.songTitle ?? "").trim(),
    artist: (s.artistName ?? "").trim(),
    genre: s.genre?.trim() || "Unknown",
    record: `${s.wins}W-${s.losses}L`,
    winPct: typeof s.winRate === "number" ? s.winRate : 0,
    vol: typeof s.totalVolumeSol === "number" ? s.totalVolumeSol : Number(s.totalVolumeSol) || 0,
    traders: s.totalUniqueTraders ?? 0,
    lastPlayed: s.lastPlayed ?? null,
    musicLink: s.musicLink ?? null,
  };
}

/**
 * Every song an artist has battled with, live.
 *
 * `handle` should be the Audius handle. Matching is case-insensitive against
 * the permalink's handle segment, and falls back to the display name so an
 * artist whose links are not on Audius still resolves.
 *
 * Returns an empty list while loading and on failure - a per-artist song list is
 * supporting detail on a page that has plenty else to show, so a failure here
 * should be quiet rather than taking the page down.
 */
export function useSongsByArtist(handle: string | null): Song[] {
  const [all, setAll] = useState<Song[]>([]);

  useEffect(() => {
    let live = true;
    fetch("/api/ww/leaderboards/songs?limit=500")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live || !j) return;
        const rows: SongLeaderboardEntry[] = j?.data?.songs ?? [];
        setAll(rows.map(toSong));
      })
      .catch(() => {
        /* quiet by design - see the doc comment */
      });
    return () => {
      live = false;
    };
  }, []);

  return useMemo(() => {
    const want = (handle ?? "").trim().toLowerCase();
    if (!want) return [];
    return all.filter((s) => {
      const fromLink = audiusHandleFromLink(s.musicLink);
      if (fromLink) return fromLink.toLowerCase() === want;
      return s.artist.toLowerCase() === want;
    });
  }, [all, handle]);
}
