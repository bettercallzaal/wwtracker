// Shared response shaping for the public /api/ww/* fan-out routes.
//
// These endpoints exist to be embedded by other people's sites, so they need
// permissive CORS and cache headers that let browsers and CDNs hold a copy too -
// every layer that caches is a layer that does not reach Sam's origin.

import { NextResponse } from "next/server";
import type { CachedPayload } from "./wwCache";

/** Window matching the upstream cache, so we never poll faster than it updates. */
export const REVALIDATE_SECONDS = 60;

/**
 * Open CORS. These routes serve public, already-public data and carry no
 * credentials, so any origin may read them - that is the entire point of a
 * fan-out surface.
 */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Cache headers by status.
 *
 * `stale-while-revalidate` lets a CDN keep answering from its copy while it
 * refreshes in the background, which further reduces upstream calls.
 *
 * `unknown` responses are explicitly not cached. Caching "we have no data" would
 * pin that answer in place for a window after upstream recovers.
 */
export function cacheHeaderFor(status: CachedPayload<unknown>["status"]): string {
  if (status === "unknown") return "no-store";
  return `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=${REVALIDATE_SECONDS * 5}`;
}

export function publicJson<T>(payload: CachedPayload<T>): NextResponse {
  return NextResponse.json(payload, {
    // 200 even when stale or unknown: the request succeeded, and the payload's
    // own `status` carries the truth. A 5xx would push consumers into their own
    // error paths, where they are far more likely to render a zero.
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": cacheHeaderFor(payload.status),
      "X-WW-Status": payload.status,
    },
  });
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
