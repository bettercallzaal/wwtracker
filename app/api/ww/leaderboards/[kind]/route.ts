// GET /api/ww/leaderboards/{artists|traders|songs}?limit=
//
// Cached leaderboards, safe to embed. Same fan-out and same failure contract as
// /api/ww/stats.
//
// `kind` is allow-listed and `limit` is clamped to an integer, so a caller can
// never steer this at an arbitrary upstream URL. Without that, a pass-through
// proxy is an open redirect against someone else's infrastructure.

import { cachedFetch, type CachedPayload } from "@/lib/wwCache";
import { publicJson, corsPreflight, REVALIDATE_SECONDS } from "@/lib/wwPublicRoute";
import { TRADER_PNL_WITHDRAWN } from "@/lib/traderLeaderboard";

const KINDS = ["artists", "traders", "songs"] as const;
type Kind = (typeof KINDS)[number];

function isKind(v: string): v is Kind {
  return (KINDS as readonly string[]).includes(v);
}

/**
 * The UI stops showing Net P&L when TRADER_PNL_WITHDRAWN is true, and this route
 * is the surface an embedder can hit directly, bypassing the widget entirely.
 * Pulling the column only from the rendered table would leave the figure sitting
 * in this JSON for anyone reading the response instead of the page. Strip the
 * same four fields the widget stops rendering, so the withdrawal is real for
 * every consumer, not merely the one we render ourselves.
 */
function withdrawTraderPnl(payload: CachedPayload<unknown>): CachedPayload<unknown> {
  const data = payload.data as { traders?: unknown } | null;
  if (!data || !Array.isArray(data.traders)) return payload;
  return {
    ...payload,
    data: {
      ...data,
      traders: data.traders.map((t) => {
        if (!t || typeof t !== "object") return t;
        const { netPnlSol, netPnlFmt, netPnlUsd, netPnlPositive, ...rest } =
          t as Record<string, unknown>;
        return rest;
      }),
    },
  };
}

/** Upstream caps at 500. Clamp rather than reject, so a bad limit still returns data. */
function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 100;
  return Math.min(500, Math.max(1, Math.floor(n)));
}

// A LITERAL, BECAUSE NEXT 16 REQUIRES ONE. It will not accept a computed
// value here and says so with an error that names no file. Kept beside its
// constant so the two cannot drift apart silently - if you change REVALIDATE_SECONDS,
// change this. Getting it wrong builds and passes every test.
export const revalidate = 60; // === REVALIDATE_SECONDS

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
  if (kind === "traders" && TRADER_PNL_WITHDRAWN) {
    return publicJson(withdrawTraderPnl(payload));
  }
  return publicJson(payload);
}

export async function OPTIONS(): Promise<Response> {
  return corsPreflight();
}
