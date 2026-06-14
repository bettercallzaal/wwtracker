import { NextResponse } from "next/server";
import {
  getLatestBalances,
  executeForWallet,
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
