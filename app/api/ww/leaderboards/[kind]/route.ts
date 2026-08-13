// GET /api/ww/leaderboards/{artists|traders|songs}?limit=
//
// Cached leaderboards, safe to embed. Same fan-out and same failure contract as
// /api/ww/stats.
//
// `kind` is allow-listed and `limit` is clamped to an integer, so a caller can
// never steer this at an arbitrary upstream URL. Without that, a pass-through
// proxy is an open redirect against someone else's infrastructure.

import { cachedFetch } from "@/lib/wwCache";
import { publicJson, corsPreflight, REVALIDATE_SECONDS } from "@/lib/wwPublicRoute";

const KINDS = ["artists", "traders", "songs"] as const;
type Kind = (typeof KINDS)[number];

function isKind(v: string): v is Kind {
  return (KINDS as readonly string[]).includes(v);
}

/** Upstream caps at 500. Clamp rather than reject, so a bad limit still returns data. */
function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 100;
  return Math.min(500, Math.max(1, Math.floor(n)));
}

export const revalidate = REVALIDATE_SECONDS;

export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string }> },
): Promise<Response> {
  const { kind } = await context.params;

  if (!isKind(kind)) {
    return Response.json(
      { error: `Unknown leaderboard "${kind}". Expected one of: ${KINDS.join(", ")}.` },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const limit = clampLimit(new URL(request.url).searchParams.get("limit"));

  const payload = await cachedFetch<unknown>(
    `leaderboard:${kind}:${limit}`,
    `https://wavewarz.info/api/public/leaderboards/${kind}?limit=${limit}`,
    { revalidateSeconds: REVALIDATE_SECONDS },
  );
  return publicJson(payload);
}

export async function OPTIONS(): Promise<Response> {
  return corsPreflight();
}
