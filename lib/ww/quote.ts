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
 * BOTH LEGS PAY THE SAME 1.5%, AND THIS MODULE SAID OTHERWISE UNTIL 2026-09-19.
 * It carried "BUYS PAY THE FEE, SELLS DO NOT" in capitals, on the strength of
 * the replay above. The replay was right and the conclusion drawn from it was
 * not, because the two are about different quantities:
 *
 *     the POOL releases the full curve amount         <- what the replay measured
 *     the TRADER receives that amount minus 1.5%      <- what a quote is for
 *
 * So a sell really does move the pool by exactly the no-fee prediction, to
 * 0.99875, while the seller gets 1.5% less than the pool released. Settled by
 * reading four sell transactions rather than by more arithmetic, at exact
 * lamports:
 *
 *     gross out of vault   70,784,699
 *     trader receives      69,642,930      98.500%
 *     artist                  711,385      67% of the fee
 *     platform                350,384      33% of the fee
 *
 * Four for four, and four buys check the same way at 98.500% into the vault.
 * Claims take no fee at all. The rule is symmetric: THE FEE IS 1.5% OF WHATEVER
 * CROSSES THE VAULT BOUNDARY, TAKEN FROM THE SIDE FACING THE TRADER. A round
 * trip therefore pays it twice.
 *
 * Full write-up and the transactions: `recon/SELLS-AND-THE-ARTIST-FEE-2026-09-19.md`
 * in the protocol repo.
 *
 * The residual ~0.1% on the pool-side replay is a slight over-prediction,
 * consistent with the program flooring integer division. A factor of 0.99895
 * fits it to 78% within 0.1%, and is deliberately NOT used: a constant with no
 * meaning that happens to fit 2,496 samples is a curve fitted to noise. That
 * refusal was right, and it sat four lines under a conclusion with the same
 * flaw - a clean fit to the wrong quantity.
 */

/** Fitted in the protocol repo against all 1,643 battles. */
export const CURVE_K = 4.993e8;

/** The total trade fee, on a buy and on a sell alike. Measured at exact lamports. */
export const TRADE_FEE = 0.015;

/**
 * The share that crosses the vault boundary. A buy puts this much of the
 * trader's SOL into the pool; a sell hands this much of the pool's release to
 * the trader. Kept under its old name because it is exported and consumers
 * import it.
 */
export const BUY_POOL_SHARE = 1 - TRADE_FEE;

/** The artist's share OF the fee. The platform takes the remaining 33%. */
export const ARTIST_FEE_SHARE = 0.67;

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
  /**
   * What the TRADER receives, after the 1.5% fee. This is the number to show a
   * seller and the number to apply a slippage tolerance to.
   *
   * It was the gross until 2026-09-19, which overstated proceeds by 1.5% and
   * made any tolerance under that impossible to satisfy.
   */
  lamportsOut: number;
  /** What leaves the vault, before the fee. `lamportsOut` plus `feeLamports`. */
  grossLamports: number;
  /** The 1.5% split between artist and platform. */
  feeLamports: number;
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
  const gross = poolLamports - poolAfter;
  const net = gross * BUY_POOL_SHARE;
  return {
    lamportsOut: net,
    grossLamports: gross,
    feeLamports: gross - net,
    poolAfterLamports: poolAfter,
  };
}

/**
 * How a fee splits, for a caller that wants to show it.
 *
 * Same on both legs. Exported because a front end that says "1.5% fee" without
 * saying where it goes is describing a cost; one that can show the artist's
 * two thirds is describing the product.
 */
export const feeSplit = (feeLamports: number) => ({
  artistLamports: feeLamports * ARTIST_FEE_SHARE,
  platformLamports: feeLamports * (1 - ARTIST_FEE_SHARE),
});

/**
 * The slippage floor to put in the instruction.
 *
 * Applied to the caller's own estimate, never to a number this module invented
 * on their behalf, and it rounds DOWN - a floor rounded up is a floor that
 * rejects trades it should have allowed.
 *
 * PASS THE NET, NOT THE GROSS. On a sell that means `lamportsOut`, which is
 * already after the fee. Applying a tolerance to `grossLamports` builds a floor
 * the program can never clear and the transaction reverts - the defect this
 * function's input had until 2026-09-19.
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
