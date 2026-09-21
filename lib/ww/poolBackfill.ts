/**
 * Pool history from the chain, for a battle the watcher did not watch.
 *
 * /api/ww/pool-history answers only from what `ww-live-watch` recorded, and it
 * has recorded since 2026-09-21. Every earlier battle, and every battle that
 * ran while the watcher was down, has no series. This rebuilds one from the
 * battle's own transactions, and it does so WITHOUT the curve: every number
 * comes from what the transaction itself says moved.
 *
 * WHAT A TRADE TRANSACTION CARRIES, measured on battle 1789948124 (fixture
 * ww-pool-backfill-transactions.json):
 *   - the program's own lines: "SOL for tokens: N lamports" on a buy, "SOL to
 *     return: N lamports" plus "Total fee: N lamports" on a sell. The pool
 *     moves by exactly those, no arithmetic of ours.
 *   - the vault's SOL balance before and after, as a cross-check. On a buy it
 *     equals the pool delta. On a sell it is one lamport SHORT whenever the fee
 *     does not split cleanly: the pool is lowered by the total fee but the two
 *     halves are paid floored, and the lost lamport stays in the vault (the
 *     crumb quote.ts documents at feeSplit). Replaying from vault deltas landed
 *     9 and 7 lamports above the account's pools on this battle, one per sell.
 *   - the token balances before and after, per mint. The side's mint moves by
 *     exactly the tokens minted or burned, which is the supply delta.
 *   - the side, from which mint moved, cross-checked against the program's own
 *     log line ("Buying shares for artist B", "Selling N shares for artist A").
 * A failed transaction (`meta.err` set) moved nothing and is skipped. EndBattle,
 * ClaimShares and the launch instructions are not trades and are skipped; the
 * pool bytes on the account are not decremented by claims, so the replay of
 * trades alone should land exactly on the account's pools, and the script
 * checks that it does.
 *
 * THE BATTLE STARTS AT ZERO. InitializeBattle logs "Battle initialized with ID
 * N starting at N" and seeds nothing; the first buy is the first lamport.
 *
 * Pure. The RPC walking lives in scripts/ww-pool-backfill.ts.
 */
import type { PoolSample } from "./poolHistory";

export interface BattleIds {
  vault: string;
  mintA: string;
  mintB: string;
}

export interface TradeStep {
  signature: string;
  slot: number;
  /** Unix seconds. */
  t: number;
  kind: "buy" | "sell";
  side: "a" | "b";
  /** Lamports the pool moved by: positive on a buy, negative on a sell. */
  poolDelta: number;
  /** Base units the supply moved by: positive on a buy, negative on a sell. */
  supplyDelta: number;
}

/** The subset of a `getTransaction` (encoding json) result this reads. */
export interface TxLike {
  slot: number;
  blockTime: number | null;
  transaction: { message: { accountKeys: string[] } };
  meta: {
    err: unknown;
    logMessages?: string[] | null;
    preBalances: number[];
    postBalances: number[];
    preTokenBalances?: Array<{ accountIndex: number; mint: string; uiTokenAmount: { amount: string } }> | null;
    postTokenBalances?: Array<{ accountIndex: number; mint: string; uiTokenAmount: { amount: string } }> | null;
  };
}

/**
 * One trade from one transaction, or null when the transaction is not a
 * successful buy or sell. Throws when it IS a trade and the numbers do not
 * agree with each other, because a step built from contradictory evidence
 * would poison every sample after it.
 */
export function tradeFromTransaction(signature: string, tx: TxLike, ids: BattleIds): TradeStep | null {
  if (tx.meta.err) return null;
  const logs = tx.meta.logMessages ?? [];
  const isBuy = logs.some((l) => l.includes("Instruction: BuyShares"));
  const isSell = logs.some((l) => l.includes("Instruction: SellShares"));
  if (!isBuy && !isSell) return null;
  if (isBuy && isSell) throw new Error(`${signature}: both a buy and a sell in one transaction; not handled`);
  const kind = isBuy ? "buy" : "sell";

  const keys = tx.transaction.message.accountKeys;
  const vi = keys.indexOf(ids.vault);
  if (vi < 0) throw new Error(`${signature}: a ${kind} that does not touch the vault ${ids.vault}`);
  const vaultDelta = tx.meta.postBalances[vi] - tx.meta.preBalances[vi];

  // THE POOL DELTA COMES FROM THE PROGRAM'S OWN LINES, NOT THE VAULT, and the
  // difference is one lamport per sell. On a sell the program lowers the pool
  // by net plus the TOTAL fee, then pays the two fee halves floored
  // independently (quote.ts, feeSplit: 61,063 + 30,076 = 91,139 of 91,140).
  // The lost lamport stays in the vault. So the vault moves by one less than
  // the pool on every sell whose fee does not divide cleanly - measured on
  // battle 1789948124, 2026-09-21: the replay from vault deltas landed 9 and 7
  // lamports above the account's two pools, one per sell. On a buy the two
  // agree exactly ("SOL for tokens" is what reaches the vault).
  const lamportsOn = (re: RegExp): number | null => {
    const m = logs.map((l) => l.match(re)).find(Boolean);
    return m ? Number(m[1]) : null;
  };
  let poolDelta: number;
  if (kind === "buy") {
    const forTokens = lamportsOn(/SOL for tokens: (\d+) lamports/);
    if (forTokens === null) throw new Error(`${signature}: a buy with no "SOL for tokens" line`);
    if (forTokens !== vaultDelta) throw new Error(`${signature}: buy says ${forTokens} for tokens but the vault moved ${vaultDelta}`);
    poolDelta = forTokens;
  } else {
    const net = lamportsOn(/SOL to return: (\d+) lamports/);
    const fee = lamportsOn(/Total fee: (\d+) lamports/);
    if (net === null || fee === null) throw new Error(`${signature}: a sell without "SOL to return" and "Total fee" lines`);
    poolDelta = -(net + fee);
    // The vault may keep at most one lamport of the fee split; anything else
    // is a different program than the one measured.
    const crumb = poolDelta - vaultDelta;
    if (crumb !== 0 && crumb !== -1) {
      throw new Error(`${signature}: sell pool delta ${poolDelta} vs vault delta ${vaultDelta}; expected them equal or one lamport apart`);
    }
  }

  // Supply: net movement per mint across every token account in the transaction.
  const byMint = new Map<string, number>();
  const pre = new Map<number, number>();
  for (const p of tx.meta.preTokenBalances ?? []) pre.set(p.accountIndex, Number(p.uiTokenAmount.amount));
  for (const p of tx.meta.postTokenBalances ?? []) {
    const delta = Number(p.uiTokenAmount.amount) - (pre.get(p.accountIndex) ?? 0);
    byMint.set(p.mint, (byMint.get(p.mint) ?? 0) + delta);
  }
  const dA = byMint.get(ids.mintA) ?? 0;
  const dB = byMint.get(ids.mintB) ?? 0;
  if ((dA !== 0) === (dB !== 0)) {
    throw new Error(`${signature}: expected exactly one side's mint to move, got A ${dA} and B ${dB}`);
  }
  const side: "a" | "b" = dA !== 0 ? "a" : "b";
  const supplyDelta = side === "a" ? dA : dB;

  // The program says which side too. Disagreement means the mints are wrong.
  const said = logs.find((l) => /for artist [AB]/.test(l))?.match(/for artist ([AB])/)?.[1]?.toLowerCase();
  if (said && said !== side) {
    throw new Error(`${signature}: the log says artist ${said.toUpperCase()} but mint ${side.toUpperCase()} moved`);
  }
  if (kind === "buy" && (poolDelta <= 0 || supplyDelta <= 0)) {
    throw new Error(`${signature}: a buy with pool delta ${poolDelta} and supply delta ${supplyDelta}`);
  }
  if (kind === "sell" && (poolDelta >= 0 || supplyDelta >= 0)) {
    throw new Error(`${signature}: a sell with pool delta ${poolDelta} and supply delta ${supplyDelta}`);
  }
  if (tx.blockTime === null || tx.blockTime === undefined) {
    throw new Error(`${signature}: no blockTime; the sample would have no time`);
  }
  return { signature, slot: tx.slot, t: tx.blockTime, kind, side, poolDelta, supplyDelta };
}

/**
 * Cumulative pools and supplies after each trade, from zero, oldest first.
 * Steps are sorted by slot; within a slot the given order is kept, which is
 * the order the RPC returned them (newest first, so callers reverse it).
 */
export function replayTrades(steps: TradeStep[]): PoolSample[] {
  const ordered = [...steps].sort((x, y) => x.slot - y.slot);
  let a = 0, b = 0, sa = 0, sb = 0;
  return ordered.map((s) => {
    if (s.side === "a") { a += s.poolDelta; sa += s.supplyDelta; } else { b += s.poolDelta; sb += s.supplyDelta; }
    return { t: s.t, a, b, sa, sb };
  });
}

/** Does the replay land on the account? Names every field that differs. */
export function endStateDiff(
  samples: PoolSample[],
  account: { a: number; b: number; sa: number; sb: number },
): Array<{ field: "a" | "b" | "sa" | "sb"; replay: number; account: number }> {
  const last = samples[samples.length - 1] ?? { t: 0, a: 0, b: 0, sa: 0, sb: 0 };
  return (["a", "b", "sa", "sb"] as const)
    .filter((f) => last[f] !== account[f])
    .map((f) => ({ field: f, replay: last[f], account: account[f] }));
}
