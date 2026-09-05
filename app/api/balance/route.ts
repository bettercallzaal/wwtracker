import { NextResponse } from "next/server";
import {
  getLatestBalances,
  executeForWallet,
  executeSavedQuery,
  DuneError,
  type BalanceRow,
} from "@/lib/dune";
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
  // Gated because an execute costs Dune credits and is therefore abusable by
  // anyone who can reach the URL. Vercel cron sends `Authorization: Bearer
  // $CRON_SECRET`; if CRON_SECRET is unset we refuse rather than leave an
  // unauthenticated credit-burn endpoint open.
  if (url.searchParams.get("refresh") === "1") {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { error: "Refresh requires CRON_SECRET authorization" },
        { status: 401 },
      );
    }
    try {
      const { rows } = await executeSavedQuery(queryId, apiKey);
      const payload: BalancePayload = {
        rows,
        source: "live",
        origin: "execute",
        wallet: defaultWallet ?? null,
        mint: null,
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
