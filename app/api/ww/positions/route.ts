// GET /api/ww/positions?battleId=123
//
// Who holds what, on which side, right now. Reads Solana directly rather than
// going through wavewarz.info, because this is not data the public API exposes -
// the mints are PDAs derived from the battle id, so the holder set is readable
// by anyone and is not currently read by anything.
//
// Same failure contract as the rest of /api/ww/*: 200 with a status field, and
// `data: null` on unknown rather than a zero-filled object. A holder list that
// came back empty because the RPC rate-limited looks exactly like a battle
// nobody traded, so an RPC failure must never be rendered as "no holders" - it
// is reported as `unknown` and the page says so.

import {
  battlePda, mintPda, decodeBattle, rankHolders,
  impliedWinnerPot, impliedMultiple, type Holder,
} from "@/lib/battlePositions";
import { publicJson, corsPreflight } from "@/lib/wwPublicRoute";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// A battle runs about ten minutes, so a minute-old position is a meaningful
// fraction of the event. Matches /api/ww/battle.
export const revalidate = 20;

/**
 * The public RPC rate-limits, and a 429 that reaches the page renders as "no
 * holders" unless it is retried or reported. Retried here, reported if it still
 * fails. Set SOLANA_RPC_URL to a keyed endpoint to stop hitting the limit.
 */
async function rpc<T>(method: string, params: unknown[], attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        cache: "no-store",
      });
      if (res.status === 429) throw new Error(`rpc ${method}: HTTP 429 rate limited`);
      if (!res.ok) throw new Error(`rpc ${method}: HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(`rpc ${method}: ${JSON.stringify(json.error).slice(0, 160)}`);
      return json.result as T;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

async function sideHolders(battleId: number, side: "a" | "b", supply: number, poolSol: number): Promise<Holder[]> {
  const mint = mintPda(battleId, side);
  const largest = await rpc<{ value: { address: string; amount: string }[] }>(
    "getTokenLargestAccounts", [mint],
  );
  const accounts = largest.value.filter((a) => Number(a.amount) > 0);
  if (accounts.length === 0) return [];
  // One batched call for the owners rather than one per account.
  const parsed = await rpc<{ value: ({ data: { parsed: { info: { owner: string } } } } | null)[] }>(
    "getMultipleAccounts", [accounts.map((a) => a.address), { encoding: "jsonParsed" }],
  );
  const raw = accounts.map((a, i) => ({
    owner: parsed.value[i]?.data?.parsed?.info?.owner ?? a.address,
    amount: Number(a.amount),
  }));
  return rankHolders(raw, supply, poolSol);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const idParam = url.searchParams.get("battleId");
  const now = new Date().toISOString();

  try {
    let battleId = idParam ? Number(idParam) : NaN;
    if (!Number.isFinite(battleId)) {
      // No id given: ask the public API which battle is current.
      const res = await fetch("https://wavewarz.info/api/public/battles?limit=1", { cache: "no-store" });
      const body = await res.json();
      battleId = Number(body?.battles?.[0]?.battleId);
    }
    if (!Number.isFinite(battleId)) {
      return publicJson({ status: "unknown", data: null, fetchedAt: now, ageSeconds: 0, source: RPC });
    }

    const acct = await rpc<{ value: { data: [string, string] } | null }>(
      "getAccountInfo", [battlePda(battleId), { encoding: "base64" }],
    );
    if (!acct.value) {
      return publicJson({ status: "unknown", data: null, fetchedAt: now, ageSeconds: 0, source: RPC });
    }
    const b = decodeBattle(Uint8Array.from(Buffer.from(acct.value.data[0], "base64")));

    const [holdersA, holdersB] = await Promise.all([
      sideHolders(battleId, "a", b.supplyA, b.poolASol),
      sideHolders(battleId, "b", b.supplyB, b.poolBSol),
    ]);

    const heldA = holdersA.reduce((s, h) => s + h.amount, 0);
    const heldB = holdersB.reduce((s, h) => s + h.amount, 0);

    return publicJson({
      status: "live",
      fetchedAt: now,
      ageSeconds: 0,
      source: RPC,
      data: {
        battleId,
        running: !b.settled,
        startTime: b.startTime,
        endTime: b.endTime,
        creator: b.creator,
        artistAWallet: b.artistAWallet,
        artistBWallet: b.artistBWallet,
        poolASol: b.poolASol,
        poolBSol: b.poolBSol,
        potSol: b.poolASol + b.poolBSol,
        supplyA: b.supplyA,
        supplyB: b.supplyB,
        // Below total supply means the difference has been claimed and burned.
        heldA, heldB,
        settled: b.settled,
        marketWinnerIsA: b.winnerArtistA,
        totalDistributionSol: b.totalDistributionSol,
        impliedIfAWins: impliedWinnerPot(b.poolASol, b.poolBSol),
        impliedIfBWins: impliedWinnerPot(b.poolBSol, b.poolASol),
        multipleIfAWins: impliedMultiple(b.poolASol, b.poolBSol),
        multipleIfBWins: impliedMultiple(b.poolBSol, b.poolASol),
        holdersA, holdersB,
      },
    });
  } catch (err) {
    // Never render an RPC failure as an empty battle.
    return publicJson({
      status: "unknown",
      data: null,
      fetchedAt: now,
      ageSeconds: 0,
      source: RPC,
      note: err instanceof Error ? err.message : "rpc failed",
    } as never);
  }
}

export const OPTIONS = corsPreflight;
