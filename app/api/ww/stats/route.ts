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

export const revalidate = REVALIDATE_SECONDS;

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
