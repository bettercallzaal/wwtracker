import { NextResponse } from "next/server";
import {
  getLatestBalances,
  getLatestResults,
  executeForWallet,
  executeSavedQuery,
  DuneError,
  type BalanceRow,
  type LatestResults,
} from "@/lib/dune";
import { decideRefresh } from "@/lib/refresh-policy";
import { isValidSolanaAddress } from "@/lib/solana";

// Revalidate the default (cached) path every 12h. The execute path opts out of
// the data cache itself; this only governs the cached-results read.
export const revalidate = 43200;

interface BalancePayload {
  rows: BalanceRow[];
  source: "live";
  origin: "cache" | "execute";
  wallet: string | null;
  mint: string | null;
  /**
   * Only present on the ?refresh=1 path. Says whether the query was actually
   * re-run and why, so a declined refresh is legible in the response instead
   * of looking identical to a successful one.
   */
  refresh?: {
    executed: boolean;
    reason: "stale" | "unknown-age" | "fresh" | "forced";
    ageMs: number | null;
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const apiKey = process.env.DUNE_API_KEY;
  const queryId = process.env.DUNE_QUERY_ID;
  const defaultWallet = process.env.DUNE_DEFAULT_WALLET;

  // Env unset -> tell the client to fall back to sample data. Not an error.
  if (!apiKey || !queryId) {
    return NextResponse.json(
      { error: "Dune not configured", configured: false },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const walletParam = url.searchParams.get("wallet");
  const mintParam = url.searchParams.get("mint");

  // ?refresh=1 asks Dune to RE-RUN the saved query rather than re-read its last
  // result. This is the daily cron's entry point. Without it the cron warmed a
  // cache over an execution that had not moved since 2026-07-03 while the UI
  // called the series live - a stale number presented confidently is worse than
  // an obviously missing one.
  //
  // An execute costs Dune credits, so this cannot be open to anyone who can
  // reach the URL. It is bounded by a RATE LIMIT rather than a bearer token,
  // because the token gate failed closed: with CRON_SECRET unset the route
  // answered 401, the execute never fired, and the chart froze for 64 days
  // while every surface still said "live". A missing env var and a hostile
  // caller were indistinguishable, and both were silent.
  //
  // The bound is Dune's own stored execution age - see lib/refresh-policy.ts.
  // The read below is the cheap cached path, so a declined refresh still
  // returns real rows and costs no credit.
  if (url.searchParams.get("refresh") === "1") {
    let latest: LatestResults;
    try {
      latest = await getLatestResults(queryId, apiKey);
    } catch (err) {
      const status = err instanceof DuneError ? (err.status ?? 502) : 500;
      const message = err instanceof Error ? err.message : "Refresh failed";
      return NextResponse.json({ error: message }, { status });
    }

    // CRON_SECRET is now an optional override, not a requirement. Present and
    // matching, it forces an execute regardless of age, which is what you want
    // when re-running by hand after fixing a query. Absent, the rate limit
    // alone governs - so an unset env var can no longer freeze anything.
    //
    // The `!!secret` is load-bearing, not defensive noise. Without it an unset
    // env var interpolates to the literal string "Bearer undefined", which any
    // caller can send - turning a missing variable into an open override. The
    // same bug shipped elsewhere in the estate this week.
    const secret = process.env.CRON_SECRET;
    const forced =
      !!secret && request.headers.get("authorization") === `Bearer ${secret}`;

    const decision = decideRefresh({
      lastExecutionMs: latest.executionEndedAt,
      nowMs: Date.now(),
    });

    if (!forced && !decision.execute) {
      // 200, not 429. The caller asked for the treasury series and is getting
      // the treasury series; only the re-run was declined. Saying so in the
      // body keeps the outcome visible instead of inferred - the same reason
      // /api/ww/* returns 200 with a status field rather than a 5xx.
      const payload: BalancePayload = {
        rows: latest.rows,
        source: "live",
        origin: "cache",
        wallet: defaultWallet ?? null,
        mint: null,
        refresh: {
          executed: false,
          reason: decision.reason,
          ageMs: decision.ageMs,
        },
      };
      return NextResponse.json(payload);
    }

    try {
      const { rows } = await executeSavedQuery(queryId, apiKey);
      const payload: BalancePayload = {
        rows,
        source: "live",
        origin: "execute",
        wallet: defaultWallet ?? null,
        mint: null,
        refresh: {
          executed: true,
          reason: forced ? "forced" : decision.reason,
          ageMs: decision.ageMs,
        },
      };
      return NextResponse.json(payload);
    } catch (err) {
      const status = err instanceof DuneError ? (err.status ?? 502) : 500;
      const message = err instanceof Error ? err.message : "Refresh failed";
      return NextResponse.json({ error: message }, { status });
    }
  }

  // Validate inputs before spending any credit.
  if (walletParam !== null && !isValidSolanaAddress(walletParam)) {
    return NextResponse.json(
      { error: "Invalid Solana wallet address" },
      { status: 400 },
    );
  }
  if (mintParam !== null && !isValidSolanaAddress(mintParam)) {
    return NextResponse.json(
      { error: "Invalid SPL mint address" },
      { status: 400 },
    );
  }

  const wallet = walletParam ?? defaultWallet ?? null;
  const isDefault = !walletParam || walletParam === defaultWallet;
  // Default wallet with native SOL = the cheap cached path.
  const useCache = isDefault && !mintParam;

  try {
    if (useCache) {
      const rows = await getLatestBalances(queryId, apiKey);
      const payload: BalancePayload = {
        rows,
        source: "live",
        origin: "cache",
        wallet,
        mint: null,
      };
      return NextResponse.json(payload);
    }

    if (!wallet) {
      return NextResponse.json(
        { error: "No wallet supplied and no default configured" },
        { status: 400 },
      );
    }

    const { rows, origin } = await executeForWallet(queryId, apiKey, {
      wallet,
      mint: mintParam ?? undefined,
    });
    const payload: BalancePayload = {
      rows,
      source: "live",
      origin,
      wallet,
      mint: mintParam,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const status = err instanceof DuneError ? (err.status ?? 502) : 500;
    const message =
      err instanceof Error ? err.message : "Unknown error fetching balances";
    return NextResponse.json({ error: message }, { status });
  }
}
