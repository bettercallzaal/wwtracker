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

/**
 * The curve constant. **EXACT, AND IT USED TO BE FITTED.**
 *
 * This read `4.993e8`, "fitted in the protocol repo against all 1,643
 * battles", and the comment four lines above it warned against exactly the
 * mistake it was: a constant with no meaning that happens to fit the samples.
 * The residual it left was described as "a slight over-prediction, consistent
 * with the program flooring integer division", which was the right diagnosis
 * attached to the wrong fix - the flooring was real and was modelled by bending
 * K instead of by flooring.
 *
 * **Measured against the deployed program on 2026-09-20.** Nine buys of
 * different sizes were simulated from an empty pool and the resulting supply
 * read out of the battle account. `K = 5e8` with supply floored to
 * `SUPPLY_QUANTUM` reproduces **nine of nine exactly**, at every size from
 * 0.0005 to 0.25 SOL. The old constant was wrong by between -0.06% and +0.52%,
 * with the error largest on the smallest trades.
 *
 * That residual was not noise. It was the quantum.
 */
export const CURVE_K = 5e8;

/**
 * Tokens are minted in whole steps of 100,000 base units, and **the step is
 * applied to each TRADE, not to the running total.**
 *
 * That distinction was got wrong once in the course of finding it. Flooring the
 * total supply reproduces a first buy into an empty pool exactly - nine of nine
 * - and then over-predicts every later buy by exactly one step, five times in
 * eight. Flooring the delta reproduces both. The stored supply is therefore a
 * SUM OF FLOORED DELTAS and drifts steadily below `sqrt(K x pool)` as a battle
 * trades, which is why it is stored at offset 196 rather than recomputed.
 *
 * This is also why `minTokensOut` set to a quote's exact continuous value
 * reverts: the program's answer is the step below.
 */
export const SUPPLY_QUANTUM = 100_000;

/** Down to a whole step, the way the program mints. */
export const floorToQuantum = (tokens: number): number =>
  Math.floor(tokens / SUPPLY_QUANTUM) * SUPPLY_QUANTUM;

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

/**
 * The curve's supply at a given pool size: continuous, unrounded.
 *
 * **This is the curve, not the mint.** A battle's actual minted supply is the
 * sum of floored trade deltas and sits at or below this. Use it to price a
 * trade; read offset 196 for what was actually minted.
 */
export const supplyAtPool = (poolLamports: number): number =>
  poolLamports > 0 ? Math.sqrt(CURVE_K * poolLamports) : 0;

/** The inverse: the pool implied by a supply. */
export const poolAtSupply = (supply: number): number =>
  supply > 0 ? (supply * supply) / CURVE_K : 0;

export interface BuyQuote {
  /**
   * Tokens received, in base units, floored to a whole step as the program
   * mints them. **This is the number to derive `minTokensOut` from.**
   */
  tokensOut: number;
  /**
   * The same trade on the continuous curve, before the step is applied.
   *
   * **For measuring price impact and nothing else.** The gap between this and
   * `tokensOut` is a rounding loss of up to one step; it is not slippage and it
   * does not grow with trade size. Feeding the floored figure to a price-impact
   * calculation makes a small trade against a large pool look catastrophic -
   * measured at 383 basis points for a trade whose curve impact is 5.
   */
  tokensOutExact: number;
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
  // FLOORED PER TRADE. The continuous difference over-predicts by up to one
  // step, which is what made a quote's own value fail as `minTokensOut`.
  const tokensOut = floorToQuantum(after - before);
  return {
    tokensOut,
    tokensOutExact: after - before,
    poolAfterLamports: poolLamports + toPool,
    feeLamports: spendLamports - toPool,
    effectivePricePerToken: tokensOut > 0 ? spendLamports / tokensOut : Infinity,
  };
}

/**
 * The smallest spend that mints anything at this pool size.
 *
 * **Below it a buy mints zero tokens, and the program refuses the trade with
 * `InvalidCalculation`.** It does not take the money - verified by simulation
 * on 2026-09-20, 1,000 and 10,000 lamports onto a 9,850,000 pool, both
 * refused, nothing moved. So this is not a leak; it is a floor, and a caller
 * who does not know about it gets an opaque error from the chain instead of a
 * number they can act on.
 *
 * **It rises with the pool**, because the curve flattens: dust that mints a
 * step into an empty battle mints nothing into a busy one. Measured against
 * the model:
 *
 *     pool 0 SOL     0.000000021 SOL
 *     pool 1 SOL     0.000287171 SOL
 *     pool 20 SOL    0.001284194 SOL
 *
 * So a 0.001 SOL buy is fine on a young battle and mints nothing on a popular
 * one, which is the worst shape for a limit: it works when you test it.
 */
export function minimumSpendLamports(poolLamports: number): number {
  // The pool growth needed for one whole step, inverted through the curve, then
  // grossed back up for the fee that never reaches the pool.
  const target = poolAtSupply(supplyAtPool(poolLamports) + SUPPLY_QUANTUM);
  const exact = Math.ceil((target - poolLamports) / BUY_POOL_SHARE);
  // Biased DOWN by the boundary tolerance, so this never quotes a minimum
  // higher than the program's. Measured at a 1 SOL pool: the program accepts
  // 287,167 and this returned 287,171. Quoting a minimum that is too high tells
  // a caller a trade is impossible when it is not.
  return Math.max(1, exact - boundaryToleranceLamports(poolLamports));
}

/**
 * How far our curve can sit from the program's at a quantisation boundary,
 * expressed in lamports of spend at this pool size.
 *
 * **OUR MODEL IS NOT BIT-EXACT AND THIS IS THE HONEST SIZE OF THAT.** It
 * reproduces every measured trade - nine first buys, eight later buys, five
 * sells, all exact - and still reads a raw delta of 99,999 where the program
 * reads 100,000, because the two compute the square root slightly differently.
 * One to two token units in 100,000, or 0.002%.
 *
 * That is invisible in a price and decisive at exactly one place: deciding
 * whether a trade mints anything at all. So the tolerance exists only there,
 * and only to make the error fall on the safe side.
 */
function boundaryToleranceLamports(poolLamports: number): number {
  // Sixteen token units of headroom, well past the one to two measured, priced
  // back into lamports through the curve at this pool.
  const supply = supplyAtPool(poolLamports);
  const slack = poolAtSupply(supply + 16) - poolAtSupply(supply);
  return Math.ceil(slack / BUY_POOL_SHARE);
}

export interface SellQuote {
  /**
   * What the TRADER receives, after the 1.5% fee. This is the number to show a
   * seller and the number to apply a slippage tolerance to.
   *
   * It was the gross until 2026-09-19, which overstated proceeds by 1.5% and
   * made any tolerance under that impossible to satisfy.
   *
   * THIS IS THE PROGRAM'S PAYOUT, NOT THE WALLET DELTA. Solana's own
   * transaction fee is paid separately by the fee payer and is outside every
   * number here - measured at 80,000 and 80,836 lamports on two real sells,
   * so it varies with priority and is not a protocol charge. A front end
   * showing "you will receive" should either say this figure is before network
   * fees or subtract the fee it is about to set. Otherwise the wallet will show
   * less than the quote and the quote will look wrong again.
   */
  lamportsOut: number;
  /** What leaves the vault, before the fee. `lamportsOut` plus `feeLamports`. */
  grossLamports: number;
  /** The 1.5% split between artist and platform. */
  feeLamports: number;
  poolAfterLamports: number;
}

/**
 * @param mintedSupply The side's ACTUAL minted supply, from offset 196 of the
 * battle account. Pass it whenever you have the account, which is whenever you
 * are about to sell. Omitted, this falls back to the curve's supply at that
 * pool, which is an upper bound: the minted total is a sum of floored deltas
 * and drifts below the curve as a battle trades, so the fallback OVERSTATES
 * proceeds on a battle with many trades. The fallback exists for quoting
 * without a fetch, not for building a transaction.
 */
export function quoteSell(
  poolLamports: number,
  sellTokens: number,
  mintedSupply?: number,
): SellQuote {
  if (sellTokens <= 0) throw new Error("token amount must be positive");
  const currentSupply = mintedSupply ?? supplyAtPool(poolLamports);
  if (sellTokens > currentSupply) {
    throw new Error(
      `selling ${sellTokens} tokens but the side's whole supply is ${Math.floor(currentSupply)}`,
    );
  }
  // PRICED OFF THE CURVE, NOT OFF THE POOL, and the difference is not small.
  //
  // Flooring the supply leaves part of the pool unrepresented by any token:
  // `poolLamports - poolAtSupply(currentSupply)` is a residual of up to one
  // quantum's worth, and it stays in the vault permanently. The program removes
  // exactly the curve value of the tokens burned and leaves that residual
  // alone. Taking `poolLamports - poolAfter` instead handed the seller the
  // whole residual on top of their tokens' worth.
  //
  // **The error is a CONSTANT number of lamports per battle, so it is worst on
  // the smallest sells.** Measured against the deployed program on 2026-09-20,
  // on a battle holding 0.0985 SOL where the residual was 20,780 lamports:
  //
  //     tokens sold    old quote    the program    overstated by
  //         100,000      109,520         88,740           23.42%
  //         500,000      464,080        443,300            4.69%
  //       1,000,000      906,380        885,600            2.35%
  //       5,000,000    4,408,780      4,388,000            0.47%
  //      22,100,000   18,659,920     18,639,140            0.11%
  //
  // The form below reproduces all five EXACTLY. A quote overstating proceeds by
  // 23% is a number a front end would have shown a seller, and any slippage
  // tolerance tighter than the overstatement reverts the trade.
  const gross = poolAtSupply(currentSupply) - poolAtSupply(currentSupply - sellTokens);
  const poolAfter = poolLamports - gross;
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
/**
 * Split a fee the way the program splits it: **both sides floored to whole
 * lamports, independently.**
 *
 * So the two halves do not always add back to the fee. Read off the program's
 * own log on 2026-09-20, on a sell whose fee was 91,140 lamports:
 *
 *     - Total fee: 91140 lamports
 *     - WaveWarZ fee: 30076 lamports
 *     - Artist fee: 61063 lamports
 *
 * 61,063 + 30,076 = 91,139. **One lamport stays in the vault**, and the same
 * thing happens on any fee that does not divide cleanly by the shares. It is a
 * rounding crumb, not a leak, and it is written down because a reconciliation
 * that assumes the halves sum will be off by a lamport per trade and nobody
 * will know why.
 *
 * **COMPUTED IN BASIS POINTS, NOT FROM THE FLOAT SHARE**, and that is not
 * fussiness. `Math.floor(750000 * 0.33)` is 247,499, because 0.33 is not
 * representable and the product lands a hair under. The program says 247,500.
 * One lamport, in the direction of shorting the platform, on every fee that
 * looked like it divided cleanly. Integer arithmetic on the basis points has no
 * such failure, and the unrounded products were worse still - they made
 * `feeSplit(750000).artistLamports` come back as 502500.00000000006, which is
 * not a number of lamports at all.
 */
export const ARTIST_FEE_BPS = 6_700;
export const PLATFORM_FEE_BPS = 10_000 - ARTIST_FEE_BPS;

export const feeSplit = (feeLamports: number) => ({
  artistLamports: Math.floor((feeLamports * ARTIST_FEE_BPS) / 10_000),
  platformLamports: Math.floor((feeLamports * PLATFORM_FEE_BPS) / 10_000),
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
