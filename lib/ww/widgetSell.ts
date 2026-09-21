/**
 * The sell side of the trade widget, as functions the component only wires.
 *
 * The widget was buy-only through the 2026-09-20 finals. Zaal ruled on
 * 2026-09-21: build the sell path today, tests first
 * (decisions/grill-2026-09-21-wwtracker-morning-4.md, item 2). Everything the
 * component decides about a sell lives here, because vitest runs in node with
 * no DOM and a decision inside a React callback is a decision no test reaches.
 */
import { quoteSell, supplyAtPool, type SellQuote } from "./quote";

export type SellEstimate =
  | {
      ok: true;
      quote: SellQuote;
      /** Which supply priced it. "curve" overstates on a traded battle; the UI says so. */
      supplySource: "minted" | "curve";
      supplyUsed: number;
      /** The fraction of the side's minted supply this sale is. */
      shareOfSide: number;
    }
  | { ok: false; reason: string };

/**
 * Size and price a sell, or say why it cannot be.
 *
 * REFUSES RATHER THAN THROWS. `quoteSell` throws on a non-positive amount and
 * on more than the side's supply; a component rendering an estimate on every
 * keystroke cannot let that escape. Each refusal carries the number the person
 * needs to fix it.
 */
export function sellEstimate(p: {
  poolLamports: number;
  /** null when the account has not been read; the curve is used and reported. */
  mintedSupply: number | null;
  sellTokens: number;
  balanceTokens: number;
}): SellEstimate {
  if (!Number.isFinite(p.sellTokens) || p.sellTokens <= 0) {
    return { ok: false, reason: "Enter an amount of tokens to sell." };
  }
  if (p.sellTokens > p.balanceTokens) {
    return {
      ok: false,
      reason: `That is more than this wallet holds on this side: ${p.balanceTokens.toLocaleString()} tokens.`,
    };
  }
  const supplyUsed = p.mintedSupply ?? supplyAtPool(p.poolLamports);
  if (p.sellTokens > supplyUsed) {
    return {
      ok: false,
      reason: `${p.sellTokens.toLocaleString()} tokens is more than the side's whole supply of ${Math.floor(supplyUsed).toLocaleString()}.`,
    };
  }
  let quote: SellQuote;
  try {
    quote = quoteSell(p.poolLamports, p.sellTokens, p.mintedSupply ?? undefined);
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
  return {
    ok: true,
    quote,
    supplySource: p.mintedSupply === null ? "curve" : "minted",
    supplyUsed,
    shareOfSide: shareOfSide(p.sellTokens, supplyUsed),
  };
}

/** balance / supply, and 0 rather than NaN when the side has no supply. */
export function shareOfSide(balanceTokens: number, supplyTokens: number): number {
  if (supplyTokens <= 0) return 0;
  return balanceTokens / supplyTokens;
}

/**
 * The meaning of a `getTokenAccountBalance` reply.
 *
 * An associated token account that was never created is an RPC ERROR, not a
 * zero balance: `{"code":-32602,"message":"Invalid param: could not find
 * account"}`. That one case means "holds nothing here" and is answered as 0.
 * Every OTHER error is thrown, because a node that is behind or a request that
 * was refused says nothing about the balance, and reporting 0 for it would tell
 * a holder they hold nothing.
 */
export function parseTokenAccountBalance(body: {
  result?: { value?: { amount?: string; decimals?: number; uiAmountString?: string } };
  error?: { code?: number; message?: string };
}): { amount: number; exists: boolean } {
  if (body.error) {
    if (/could not find account/i.test(body.error.message ?? "")) {
      return { amount: 0, exists: false };
    }
    throw new Error(`rpc getTokenAccountBalance: ${body.error.message ?? JSON.stringify(body.error)}`);
  }
  const amount = body.result?.value?.amount;
  if (typeof amount !== "string" || !/^\d+$/.test(amount)) {
    throw new Error("rpc getTokenAccountBalance: no amount in the reply");
  }
  return { amount: Number(amount), exists: true };
}
