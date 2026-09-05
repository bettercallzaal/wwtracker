// GET /api/audius/tracks/[id]
//
// Fetch the full track list for a single artist on demand.
// Used by the Artists component when expanding "show all tracks".
//
// This avoids sending every track for every artist in the main roster
// payload. The expand() call fetches the full list only when the user
// actually clicks to see all tracks, not preemptively.

import { NextResponse } from "next/server";
import { AUDIUS_ID_BY_HANDLE } from "@/lib/artists";

// Half an hour, same window as the roster route.
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

// Keep only the fields the UI reads. A full Audius track object is ~10x this.
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

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const param = params.id;

  // The parameter could be either a handle (e.g., "BetterCallZaal") or an
  // audiusId (e.g., "lzq2G"). Try the handle map first; if no match, use
  // as-is assuming it's an audiusId. Audius API errors are handled below.
  const resolvedId = AUDIUS_ID_BY_HANDLE[param as keyof typeof AUDIUS_ID_BY_HANDLE] ?? param;

  // Get the host from Audius discovery API
  const hostRes = await getJson<{ data?: string[] }>("https://api.audius.co");
  const hosts = hostRes?.data ?? [];
  const host = hosts.length
    ? hosts[Math.floor(Math.random() * hosts.length)]
    : "https://discoveryprovider.audius.co";

  // Fetch tracks for this artist
  const tracksRes = await getJson<{ data?: Record<string, unknown>[] }>(
    `${host}/v1/users/${resolvedId}/tracks?app_name=${APP}&limit=100&sort=plays`,
  );

  const tracks = (tracksRes?.data ?? []).map(trimTrack);

  return NextResponse.json(
    { tracks },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 4}`,
      },
    },
  );
}
