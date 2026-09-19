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
import { buySharesInstruction, deadlineIn, type BattleAccounts, type Instruction } from "./instructions";
import { BUY_POOL_SHARE, quoteBuy, withSlippage } from "./quote";
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
}

export interface BuyPlan {
  instruction: Instruction;
  /** The pool the floor was computed against. Shown so a person can see it moved. */
  poolLamports: number;
  /** What the curve says, before the program's own arithmetic. */
  estimatedTokensOut: number;
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
export async function planBuy(p: PlanBuyParams): Promise<BuyPlan> {
  const state = await p.readBattleState();
  const poolLamports = state.poolLamports[p.side];
  const quote = quoteBuy(poolLamports, p.amountLamports);
  const minTokensOut = withSlippage(quote.tokensOut, p.slippageBps);

  // Computed from the SAME fresh read the floor uses. An impact figure from a
  // stale pool would be the defect #300 fixed, wearing a different name.
  const priceImpact = assessPriceImpact(
    priceImpactBps({
      poolBeforeLamports: poolLamports,
      // The pool moves by what reaches it, not by what was spent - the 1.5% fee
      // never enters the pool and so causes no price movement.
      poolDeltaLamports: p.amountLamports * BUY_POOL_SHARE,
      tokens: quote.tokensOut,
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
    minTokensOut,
    feeLamports: quote.feeLamports,
    priceImpact,
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
