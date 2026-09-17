/**
 * What a trade is likely to give you, before you ask the program.
 *
 * THESE ARE ESTIMATES AND THE MODULE IS NAMED FOR IT. The exact number comes
 * from simulating the transaction (`/api/ww/trade` action `preflight`), which
 * asks the deployed program and cannot be wrong. This exists for the number a
 * widget shows while someone is still typing, where a round trip per keystroke
 * is not worth it. Nothing here should ever be the basis of a slippage floor -
 * the floor is the trader's tolerance applied to their own expectation, which
 * is the point of having one.
 *
 * THE CURVE, and how well it actually holds. `supply = sqrt(K x pool)` with
 * K = 4.993e8, from the protocol repo's STATE.md. Replayed against every trade
 * in the committed snapshot - 897 battles, 7,552 buys, 2,496 sells - by
 * reconstructing pool state trade by trade and comparing the predicted delta to
 * what the chain recorded:
 *
 *     buys    median actual/predicted 0.9998,  89.9% within 0.5%,  97.6% within 2%
 *     sells   median actual/predicted 0.99875, 96.7% within 0.5%
 *
 * BUYS PAY THE FEE, SELLS DO NOT, and that was measured rather than assumed.
 * A buy puts 98.5% of the SOL into the pool; the 1.5% is the trade fee. Applying
 * the same 1.5% to sell proceeds gives a median ratio of 1.014 - consistently
 * 1.4% wrong, with a spread too tight to be noise. Tested against the
 * alternatives: no fee at all fits (0.99875), 1.0% does not (1.0088), the
 * artist's 1.005% leg does not (1.0089).
 *
 * The residual ~0.1% on sells is a slight over-prediction, consistent with the
 * program flooring integer division. A factor of 0.99895 fits it to 78% within
 * 0.1%, and is deliberately NOT used: a constant with no meaning that happens to
 * fit 2,496 samples is a curve fitted to noise, and it would be published as
 * though it were a fee.
 */

/** Fitted in the protocol repo against all 1,643 battles. */
export const CURVE_K = 4.993e8;

/** A buy puts this share of its SOL into the pool. The rest is the 1.5% fee. */
export const BUY_POOL_SHARE = 0.985;

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Token supply at a given pool size, in lamports. */
export const supplyAtPool = (poolLamports: number): number =>
  poolLamports > 0 ? Math.sqrt(CURVE_K * poolLamports) : 0;

/** The inverse: the pool implied by a supply. */
export const poolAtSupply = (supply: number): number =>
  supply > 0 ? (supply * supply) / CURVE_K : 0;

export interface BuyQuote {
  /** Estimated tokens received, in the mint's base units. */
  tokensOut: number;
  /** What the pool becomes, for showing the price impact. */
  poolAfterLamports: number;
  /** The 1.5% that does not reach the pool. */
  feeLamports: number;
  /** Tokens per SOL at this size, against the same at the margin. */
  effectivePricePerToken: number;
}

export function quoteBuy(poolLamports: number, spendLamports: number): BuyQuote {
  if (spendLamports <= 0) throw new Error("spend must be positive");
  const toPool = spendLamports * BUY_POOL_SHARE;
  const before = supplyAtPool(poolLamports);
  const after = supplyAtPool(poolLamports + toPool);
  const tokensOut = after - before;
  return {
    tokensOut,
    poolAfterLamports: poolLamports + toPool,
    feeLamports: spendLamports - toPool,
    effectivePricePerToken: tokensOut > 0 ? spendLamports / tokensOut : Infinity,
  };
}

export interface SellQuote {
  /** Estimated lamports received. Measured to take no percentage fee. */
  lamportsOut: number;
  poolAfterLamports: number;
}

export function quoteSell(poolLamports: number, sellTokens: number): SellQuote {
  if (sellTokens <= 0) throw new Error("token amount must be positive");
  const currentSupply = supplyAtPool(poolLamports);
  if (sellTokens > currentSupply) {
    throw new Error(
      `selling ${sellTokens} tokens but the side's whole supply is ${Math.floor(currentSupply)}`,
    );
  }
  const poolAfter = poolAtSupply(currentSupply - sellTokens);
  return { lamportsOut: poolLamports - poolAfter, poolAfterLamports: poolAfter };
}

/**
 * The slippage floor to put in the instruction.
 *
 * Applied to the caller's own estimate, never to a number this module invented
 * on their behalf, and it rounds DOWN - a floor rounded up is a floor that
 * rejects trades it should have allowed.
 *
 * `minOut: 0` disables the protection entirely, which is why callers must pass a
 * tolerance rather than get a default. There is no safe default: 0 is unsafe and
 * any non-zero number is a guess about someone else's risk appetite.
 */
export function withSlippage(estimate: number, toleranceBps: number): number {
  if (toleranceBps < 0 || toleranceBps > 10_000) {
    throw new Error(`slippage tolerance out of range: ${toleranceBps} bps`);
  }
  return Math.floor((estimate * (10_000 - toleranceBps)) / 10_000);
}

export const solToLamports = (sol: number): number => Math.round(sol * LAMPORTS_PER_SOL);
export const lamportsToSol = (lamports: number): number => lamports / LAMPORTS_PER_SOL;
