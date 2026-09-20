// GET /api/ww/stats
//
// Cached platform stats, safe to embed from anywhere. One upstream call per
// minute serves every consumer, however much traffic they have.
//
// Response:
//   { status: "live" | "stale" | "unknown",
//     fetchedAt, ageSeconds, data, source, error? }
//
// `data` is null when status is "unknown". Render that as unknown, never as 0.

import { cachedFetch } from "@/lib/wwCache";
import type { PublicStats } from "@/lib/wavewarzApi";
import { publicJson, corsPreflight, REVALIDATE_SECONDS } from "@/lib/wwPublicRoute";

// A LITERAL, BECAUSE NEXT 16 REQUIRES ONE. It will not accept a computed
// value here and says so with an error that names no file. Kept beside its
// constant so the two cannot drift apart silently - if you change REVALIDATE_SECONDS,
// change this. Getting it wrong builds and passes every test.
export const revalidate = 60; // === REVALIDATE_SECONDS

export async function GET(): Promise<Response> {
  const payload = await cachedFetch<PublicStats>(
    "stats",
    "https://wavewarz.info/api/public/stats",
    { revalidateSeconds: REVALIDATE_SECONDS },
  );
  return publicJson(payload);
}

export async function OPTIONS(): Promise<Response> {
  return corsPreflight();
}
