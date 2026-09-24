/**
 * Build a trade from state read NOW, not from state read when the page loaded.
 *
 * THE DEFECT THIS EXISTS TO FIX. `TradeWidget` read the battle's pools once in
 * its mount effect and kept them in component state. `minTokensOut` - the
 * slippage floor, the trader's only protection against the price moving - was
 * computed from that. So the floor was calculated against the pool as it was
 * when the page loaded, which on a live battle is whenever the person happened
 * to open the tab.
 *
 * Both directions are bad and neither announces itself. If the pool grew, the
 * floor is too low and the protection is weaker than the number on screen
 * claims. If the pool shrank, the floor is too high and the trade reverts after
 * the fee is spent.
 *
 * WHY NOBODY NOTICED, and it is the same shape as the ATA bug. The widget has
 * never run on a live battle, and on a settled battle the pool cannot move. The
 * condition that hides the defect is the condition that makes it harmless, so
 * it would have surfaced on the first real trade and not before. Found on
 * 2026-09-18 by scoring PRD section 56 against the code rather than against
 * memory - "fresh quote" is the first of its six requirements.
 *
 * WHY IT IS A MODULE AND NOT A FIX INSIDE THE COMPONENT. A read done at the
 * right moment is a property of the ORDER of operations, and order inside a
 * React callback is not reachable from a test. Here the read is an argument, so
 * a test can hand it a pool that changes between calls and require the plan to
 * change with it - which is exactly what the old code would fail.
 */
import {
  battleAccountsFromRaw,
  buySharesInstruction,
  deadlineIn,
  sellSharesInstruction,
  type BattleAccounts,
  type Instruction,
} from "./instructions";
import {
  BUY_POOL_SHARE,
  SUPPLY_QUANTUM,
  minimumSpendLamports,
  quoteBuy,
  quoteBuyAtSupply,
  poolAtSupply,
  quoteSell,
  supplyAtPool,
  withSlippage,
} from "./quote";
import {
  PriceImpactExceededError,
  assessPriceImpact,
  priceImpactBps,
  type PriceImpactAssessment,
} from "./priceImpact";

export interface BattleState {
  /** The three wallets, from the battle account. */
  accounts: BattleAccounts;
  /** Lamports in each artist's pool, at the moment of the read. */
  poolLamports: { a: number; b: number };
  /**
   * Each side's MINTED supply, base units, from bytes 196 and 204. Optional
   * because a caller quoting without the account cannot know it; when it is
   * present a sell is priced off it, and when it is absent the plan says it
   * priced off the curve instead (`supplySource`). See `planSell`.
   */
  mintedSupply?: { a: number; b: number };
}

/**
 * A `BattleState` straight from the raw account.
 *
 * THIS WAS MISSING AND IT IS THE KIND OF GAP ONLY A WALKTHROUGH FINDS. `planBuy`
 * and `planSell` both require a `BattleState`, and until now the only way to
 * produce one was to hand-decode two u64s at offsets 212 and 220 - so every
 * integrator using the planners had to know byte offsets that the library
 * otherwise keeps to itself. The first end-to-end script written against the
 * exported surface hit it in the first five minutes.
 *
 * The offsets are duplicated here rather than imported from `battleRecord.ts`
 * for the same reason they are duplicated there: a shared constant that moves
 * takes every reader with it, and these are verified against thirty real
 * accounts in two places independently.
 */
export function battleStateFromRaw(raw: Uint8Array): BattleState {
  if (raw.length < 228) {
    throw new Error(
      `battle account too short for pools: ${raw.length} bytes, 228 needed. ` +
        "A discovery slice of 256 bytes is enough; a 132-byte read is not.",
    );
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  return {
    accounts: battleAccountsFromRaw(raw),
    poolLamports: {
      a: Number(view.getBigUint64(212, true)),
      b: Number(view.getBigUint64(220, true)),
    },
    mintedSupply: {
      a: Number(view.getBigUint64(196, true)),
      b: Number(view.getBigUint64(204, true)),
    },
  };
}

export interface BuyPlan {
  instruction: Instruction;
  /** The pool the floor was computed against. Shown so a person can see it moved. */
  poolLamports: number;
  /** What the curve says, before the program's own arithmetic. */
  estimatedTokensOut: number;
  /**
   * Which curve form produced that estimate.
   *
   * `minted` is the exact one, priced off the pool the stored supply implies.
   * `pool` is the older form, used only when the caller's `BattleState` has no
   * `mintedSupply`; it misses about one buy in five, always LOW by one step.
   * A caller showing the estimate to somebody should know which it is holding.
   */
  pricedFrom: "minted" | "pool";
  /** The floor actually put in the instruction. */
  minTokensOut: number;
  feeLamports: number;
  /**
   * What this trade does to the price, and whether anything checked it.
   * Always computed; `checked: false` when no maximum was configured, which a
   * caller must be able to tell apart from "checked and fine".
   */
  priceImpact: PriceImpactAssessment;
}

export interface PlanBuyParams {
  battleId: number;
  trader: string;
  side: "a" | "b";
  amountLamports: number;
  slippageBps: number;
  deadlineSeconds: number;
  /**
   * Reads the battle NOW. Called on every plan, deliberately - if a caller
   * wants to cache this, the caching is theirs to justify and not a default
   * buried in here.
   */
  readBattleState: () => Promise<BattleState>;
  /**
   * The asset's `maximum_price_impact`, in basis points, from PRD 16's registry.
   *
   * DELIBERATELY OPTIONAL AND DELIBERATELY UNDEFAULTED. Omitting it means no
   * limit is configured for this asset, and the plan says so rather than
   * quietly passing; supplying it means the plan REFUSES when the trade moves
   * the price further. A fallback number here would be a limit nobody chose
   * that reads exactly like one somebody did.
   */
  maxPriceImpactBps?: number;
  /** Injectable only so a test can pin the deadline. */
  now?: () => number;
}

/**
 * One plan, from one fresh read.
 *
 * `readBattleState` is awaited every time this is called. That is the whole
 * point of the module and the thing the test pins: a plan built twice against a
 * moving pool must produce two different floors.
 */
/**
 * Thrown when a trade is too small to mint or burn a whole step.
 *
 * Its own type because a caller shows this to a person - it means "trade more"
 * and nothing is wrong - while every other refusal here means "something moved
 * or something is misconfigured".
 */
export class DustTradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DustTradeError";
  }
}

export async function planBuy(p: PlanBuyParams): Promise<BuyPlan> {
  const state = await p.readBattleState();
  const poolLamports = state.poolLamports[p.side];
  /**
   * PRICE OFF THE STORED SUPPLY WHEN WE HAVE IT.
   *
   * A buy is minted from the pool the supply IMPLIES, not the pool the vault
   * holds - measured exact on 127 real buys where the pool-based form misses
   * about one in five, always low by one 100,000 step (see `quote.ts`). The
   * account carries that supply at bytes 196 and 204, so a caller reading a
   * 256-byte slice already has it.
   *
   * The fallback is the old form rather than a refusal, because `mintedSupply`
   * is optional on `BattleState` and a caller that cannot supply it should get
   * a slightly conservative quote instead of an error. Which was used is
   * reported, the same way `planSell` reports `supplySource`, so nobody has to
   * guess which number they are holding.
   */
  const minted = state.mintedSupply?.[p.side];
  const buyPricedFrom: "minted" | "pool" = minted === undefined ? "pool" : "minted";
  const quote =
    minted === undefined
      ? quoteBuy(poolLamports, p.amountLamports)
      : quoteBuyAtSupply(minted, p.amountLamports);

  // REFUSE A TRADE THAT MINTS NOTHING, with the number the caller needs.
  //
  // Tokens mint in whole steps, so below a threshold that RISES WITH THE POOL a
  // buy mints zero. The program refuses those itself, with `InvalidCalculation`
  // and no further detail, and it does not take the money. Without this the
  // caller would instead hit the `minTokensOut` guard - floored to 0 by
  // `withSlippage` - and be told to pass 1, which is not the problem and would
  // not fix it.
  // REFUSE ONLY WHAT IS CLEARLY DUST, not what merely sits on the boundary.
  //
  // Our curve and the program's diverge by one to two token units in 100,000 at
  // a quantisation boundary, so `tokensOut` can read 0 for a spend the program
  // mints a whole step for - measured at a 1 SOL pool, a four-lamport window.
  // Refusing there would reject a trade that works, which is the same mistake
  // as the sell-floor guard and in the same direction: our rule tighter than
  // the chain's. So the test is against the CONTINUOUS figure with headroom,
  // and anything inside the window is handed to the program to decide.
  if (quote.tokensOut <= 0 && quote.tokensOutExact < SUPPLY_QUANTUM - 16) {
    const need = minimumSpendLamports(poolLamports);
    throw new DustTradeError(
      `${p.amountLamports} lamports mints no tokens at a pool of ${poolLamports}. ` +
        `The minimum here is ${need} lamports (${(need / 1e9).toFixed(9)} SOL), and it rises as the pool grows.`,
    );
  }

  // Floor at 1, never 0. Inside the headroom window the dust check above
  // deliberately lets the plan through: the program mints a full step where
  // our continuous math reads 99,984..99,999 (wwCurveMeasured.test.ts, the
  // boundary fixture), so `tokensOut` is 0 while the trade is good. A floor of
  // 0 then hits `buyFloor` in instructions.ts, which refuses with "pass 1, not
  // 0" - the exact misleading error the dust check exists to prevent, thrown
  // on the other side of the boundary. Measured 2026-09-20 at pool
  // 1,000,000,565 and spend 287,167.
  const minTokensOut = Math.max(1, withSlippage(quote.tokensOut, p.slippageBps));

  // Computed from the SAME fresh read the floor uses. An impact figure from a
  // stale pool would be the defect #300 fixed, wearing a different name.
  /**
   * THE SPOT PRICE MUST COME FROM THE POOL THE TOKENS CAME FROM.
   *
   * Impact is the effective price over the spot price, and both halves have to
   * be quoted at the same position on the curve. Since #412 the tokens are
   * minted from the pool the STORED SUPPLY implies, while this still read the
   * spot off the pool the vault holds - and those differ by the flooring
   * residual, 2,348,580 lamports on battle 1789948124's side A.
   *
   * Measured on that side for a 0.05 SOL buy: 2,322 bps against the vault's
   * pool, 2,723 against the implied one. FOUR PERCENTAGE POINTS, in the unsafe
   * direction - a `maxPriceImpactBps` of 2,500 would have passed a trade whose
   * real impact the limit was written to refuse.
   */
  const pricingPool = minted === undefined ? poolLamports : poolAtSupply(minted);
  const priceImpact = assessPriceImpact(
    priceImpactBps({
      poolBeforeLamports: pricingPool,
      // The pool moves by what reaches it, not by what was spent - the 1.5% fee
      // never enters the pool and so causes no price movement.
      poolDeltaLamports: p.amountLamports * BUY_POOL_SHARE,
      // The CONTINUOUS figure: impact is the curve's slope, not the mint's step.
      tokens: quote.tokensOutExact,
    }),
    p.maxPriceImpactBps,
  );

  // PRD 56: outside configured safety limits, FAIL rather than execute at an
  // unreasonable price. Throwing rather than flagging, because a flag is
  // something a caller can ignore and an ignorable limit is not a limit.
  if (priceImpact.exceeded) {
    throw new PriceImpactExceededError(priceImpact.impactBps, priceImpact.limitBps!);
  }

  return {
    instruction: buySharesInstruction({
      battleId: p.battleId,
      trader: p.trader,
      battle: state.accounts,
      artistA: p.side === "a",
      amountLamports: p.amountLamports,
      minTokensOut,
      deadline: deadlineIn(p.deadlineSeconds, p.now ? p.now() : Date.now()),
    }),
    poolLamports,
    estimatedTokensOut: quote.tokensOut,
    pricedFrom: buyPricedFrom,
    minTokensOut,
    feeLamports: quote.feeLamports,
    priceImpact,
  };
}

export interface SellPlan {
  instruction: Instruction;
  poolLamports: number;
  /** What the trader receives, after the 1.5% fee. The floor applies to this. */
  estimatedLamportsOut: number;
  /** What leaves the vault, before the fee. This is what moves the price. */
  grossLamports: number;
  /** The floor actually put in the instruction, in lamports. */
  minSolOut: number;
  feeLamports: number;
  priceImpact: PriceImpactAssessment;
  /**
   * Which supply the quote was priced off. "minted" is the account's own
   * figure and is what a transaction should be built from; "curve" is the
   * fallback for a state read without the account, and overstates proceeds on
   * a battle with many trades. A caller building a real sell from a "curve"
   * plan should know it did.
   */
  supplySource: "minted" | "curve";
  /** The supply figure actually used, base units. */
  supplyUsed: number;
}

export interface PlanSellParams {
  battleId: number;
  trader: string;
  side: "a" | "b";
  /** Tokens to sell, in the mint's base units. */
  amountTokens: number;
  slippageBps: number;
  deadlineSeconds: number;
  readBattleState: () => Promise<BattleState>;
  maxPriceImpactBps?: number;
  now?: () => number;
}

/**
 * The sell side of `planBuy`, and it is NOT a mirror image. Two things differ,
 * both of them consequences of where the fee sits.
 *
 * THE FLOOR GOES ON THE NET. `minSolOut` is computed from what the trader
 * receives, which is 1.5% below what leaves the vault. Until 2026-09-19
 * `quoteSell` returned the gross and called it proceeds; a floor built on that
 * is a floor the program can never clear, so any tolerance under about 1.5%
 * reverted every time. That is the reason this function did not exist sooner -
 * it could not have been written correctly against the old quote.
 *
 * THE PRICE MOVES BY THE GROSS. On a buy the pool grows by what reaches it,
 * 98.5%, because the fee never enters the pool. On a sell the pool releases the
 * FULL curve amount and the fee is taken from that afterwards, so the price
 * impact is computed on `grossLamports`, not on what the trader pockets. Using
 * the net here would understate every sell's impact by 1.5%.
 */
export async function planSell(p: PlanSellParams): Promise<SellPlan> {
  const state = await p.readBattleState();
  const poolLamports = state.poolLamports[p.side];
  // THE MINTED SUPPLY, WHEN THE READ HAS IT. Until 2026-09-21 this called
  // `quoteSell(pool, tokens)` and priced every sell off the curve's supply at
  // that pool, which quote.ts documents as an upper bound: the minted total is
  // a sum of floored deltas and drifts below the curve as a battle trades. The
  // planner had the account and did not pass it. About 10 lamports on the
  // measured case; more the longer a battle trades.
  const minted = state.mintedSupply?.[p.side];
  const quote = quoteSell(poolLamports, p.amountTokens, minted);
  const supplySource = minted === undefined ? "curve" : "minted";
  const supplyUsed = minted ?? supplyAtPool(poolLamports);
  const minSolOut = withSlippage(quote.lamportsOut, p.slippageBps);

  const priceImpact = assessPriceImpact(
    priceImpactBps({
      poolBeforeLamports: poolLamports,
      // Negative: a sell shrinks the pool. The magnitude is the FULL release,
      // fee included, because the fee leaves the vault too.
      poolDeltaLamports: -quote.grossLamports,
      tokens: p.amountTokens,
    }),
    p.maxPriceImpactBps,
  );

  if (priceImpact.exceeded) {
    throw new PriceImpactExceededError(priceImpact.impactBps, priceImpact.limitBps!);
  }

  return {
    instruction: sellSharesInstruction({
      battleId: p.battleId,
      trader: p.trader,
      battle: state.accounts,
      artistA: p.side === "a",
      amountTokens: p.amountTokens,
      minSolOut,
      deadline: deadlineIn(p.deadlineSeconds, p.now ? p.now() : Date.now()),
    }),
    poolLamports,
    estimatedLamportsOut: quote.lamportsOut,
    grossLamports: quote.grossLamports,
    minSolOut,
    feeLamports: quote.feeLamports,
    priceImpact,
    supplySource,
    supplyUsed,
  };
}

/**
 * How far the pool moved between two reads, in basis points.
 *
 * For telling somebody their quote changed while they were deciding, rather
 * than silently signing a different trade than the one they looked at. Returns
 * 0 when the earlier pool is 0, because a move from nothing has no meaningful
 * ratio and reporting Infinity in a UI is worse than reporting no change.
 */
export function poolMoveBps(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((after - before) / before) * 10_000);
}
