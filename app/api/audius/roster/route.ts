// GET /api/audius/roster
//
// The whole artist roster hydrated from Audius, in one server-side call.
//
// WHY THIS EXISTS. Artists.tsx and Music.tsx each walked the 35-artist roster
// from the browser, two requests per artist in one case and one per artist in
// the other. That is ~105 calls to api.audius.co per visitor. A measured page
// load made 208 requests with 86 coming back 429, so the roster rendered
// half-empty and the play totals were wrong.
//
// Limiting client concurrency helped the burst but not the volume - the limit
// is per IP over time, and the requests were still per visitor. Moving the walk
// to the server fixes the actual problem: Audius now sees one roster refresh
// per cache window for the whole world, and the browser makes a single request
// to our own origin. Same reasoning as the /api/ww/* routes over wavewarz.info.

import { NextResponse } from "next/server";
import { ROSTER } from "@/lib/artists";

// Half an hour. Play counts move slowly and nothing here is time-critical.
export const revalidate = 1800;

const APP = "wwtracker";

interface Track {
  id: string;
  title: string;
  play_count: number;
  favorite_count: number;
  repost_count: number;
  release_date?: string;
  genre: string;
  permalink: string;
}

interface Totals {
  trackCount: number;
  plays: number;
  favorites: number;
}

interface ArtistCard {
  handle: string;
  audiusId: string;
  user: {
    name?: string;
    handle?: string;
    follower_count?: number;
    track_count?: number;
    profile_picture?: unknown;
    bio?: string;
  } | null;
  totals: Totals;
  genres: [string, number][];
  byMonth: [string, number][];
  /** Deduped union of this artist's top-by-plays, top-by-reposts and newest. */
  tracks: Track[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson<T>(url: string, retries = 2): Promise<T | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate } });
      if (res.status === 429) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt === retries) return null;
      await sleep(300 * 2 ** attempt);
    }
  }
  return null;
}

/** Keep only the fields the UI reads. A full Audius track object is ~10x this. */
function trimTrack(t: Record<string, unknown>): Track {
  return {
    id: String(t.id ?? ""),
    title: String(t.title ?? ""),
    play_count: Number(t.play_count ?? 0),
    favorite_count: Number(t.favorite_count ?? 0),
    repost_count: Number(t.repost_count ?? 0),
    release_date:
      typeof t.release_date === "string" ? t.release_date.slice(0, 10) : undefined,
    genre: String(t.genre ?? "Unknown"),
    permalink: String(t.permalink ?? ""),
  };
}

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<(R | null)[]> {
  const out: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  const worker = async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        out[i] = await fn(items[i]);
      } catch {
        out[i] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function computeAggregates(tracks: Track[]): Omit<ArtistCard, "handle" | "audiusId" | "user"> {
  // Compute totals from full track list
  const totals: Totals = {
    trackCount: tracks.length,
    plays: tracks.reduce((s, t) => s + t.play_count, 0),
    favorites: tracks.reduce((s, t) => s + t.favorite_count, 0),
  };

  // Genre histogram
  const genreMap = new Map<string, number>();
  for (const t of tracks) {
    const g = t.genre || "Unknown";
    genreMap.set(g, (genreMap.get(g) ?? 0) + 1);
  }
  const genres = [...genreMap.entries()];

  // Release month histogram (skip tracks without release_date)
  const monthMap = new Map<string, number>();
  for (const t of tracks) {
    if (t.release_date) {
      const m = t.release_date.slice(0, 7);
      monthMap.set(m, (monthMap.get(m) ?? 0) + 1);
    }
  }
  const byMonth = [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // The UI renders a GLOBAL top 12 by plays, top 6 by reposts and 6 newest. A
  // track can only reach a global top N if it is in its own artist's top N, so
  // sending each artist's top N is exact - no aggregate changes.
  //
  // Sending three separate arrays of whole track objects is not, though: the
  // lists overlap heavily (a most-played track is usually also a most-reposted
  // one) and for an artist with 23 tracks, 12 + 6 + 6 is more objects than the
  // full catalogue. That is why the first version of this route shrank the
  // payload by 953 bytes out of 276,067. So the union is deduped by id and sent
  // once, with the three orderings recoverable client-side by sorting.
  const byId = new Map<string, Track>();
  const take = (list: Track[], n: number) => {
    for (const t of list.slice(0, n)) byId.set(t.id, t);
  };
  take([...tracks].sort((a, b) => b.play_count - a.play_count), 12);
  take([...tracks].sort((a, b) => b.repost_count - a.repost_count), 6);
  take(
    [...tracks]
      .filter((t) => t.release_date)
      .sort((a, b) => (a.release_date! < b.release_date! ? 1 : -1)),
    6,
  );

  return { totals, genres, byMonth, tracks: [...byId.values()] };
}

export async function GET(): Promise<NextResponse> {
  const hostRes = await getJson<{ data?: string[] }>("https://api.audius.co");
  const hosts = hostRes?.data ?? [];
  const host = hosts.length
    ? hosts[Math.floor(Math.random() * hosts.length)]
    : "https://discoveryprovider.audius.co";

  const cards = await mapPool(ROSTER, 4, async (a): Promise<ArtistCard> => {
    const [u, t] = await Promise.all([
      getJson<{ data?: ArtistCard["user"] }>(
        `${host}/v1/users/${a.audiusId}?app_name=${APP}`,
      ),
      getJson<{ data?: Record<string, unknown>[] }>(
        `${host}/v1/users/${a.audiusId}/tracks?app_name=${APP}&limit=100&sort=plays`,
      ),
    ]);
    const tracks = (t?.data ?? []).map(trimTrack);
    const agg = computeAggregates(tracks);
    return {
      handle: a.handle,
      audiusId: a.audiusId,
      user: u?.data ?? null,
      ...agg,
    };
  });

  const artists = cards.map((c, i) =>
    c ?? {
      handle: ROSTER[i].handle,
      audiusId: ROSTER[i].audiusId,
      user: null,
      totals: { trackCount: 0, plays: 0, favorites: 0 },
      genres: [],
      byMonth: [],
      tracks: [],
    },
  );

  // Every card empty means Audius was unreachable, not that the roster is
  // empty. The client needs to tell those apart to render honestly, and a
  // failure must not be cached for the full window.
  const reachable = artists.some((a) => a.user !== null);

  return NextResponse.json(
    { updatedAt: new Date().toISOString(), reachable, artists },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": reachable
          ? `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 4}`
          : "no-store",
      },
    },
  );
}
