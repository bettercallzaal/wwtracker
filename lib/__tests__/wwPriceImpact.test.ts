/**
 * PRD section 56's last requirement: the price a trade moves against itself,
 * and the refusal when that is more than somebody allowed.
 *
 * THE THREE-STATE TEST IS THE ONE THAT MATTERS. An assessment must distinguish
 * within a limit, over a limit, and never checked - and a caller must not be
 * able to read the third as the first. A boolean would collapse "we did not
 * look" into "it is fine", which is the reassuring direction and therefore the
 * dangerous one.
 *
 * The arithmetic is checked against an independent approximation rather than
 * against itself. For a `sqrt` curve the average price over a small move sits
 * midway, so impact should be about a quarter of the fractional pool growth.
 * That holds to three decimal places for small trades and diverges for large
 * ones, which is what a linear approximation of a curve is supposed to do - so
 * the agreement is evidence and the divergence is expected rather than a
 * failure.
 */
import { describe, expect, it } from "vitest";
import {
  PriceImpactExceededError,
  assessPriceImpact,
  describePriceImpact,
  priceImpactBps,
  spotPricePerToken,
} from "../ww/priceImpact";
import { BUY_POOL_SHARE, quoteBuy } from "../ww/quote";
import { planBuy, type BattleState } from "../ww/tradePlan";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";
import { battleAccountsFromRaw } from "../ww/instructions";

const POOL = 5_000_000_000; // 5 SOL, a realistic battle pool

const impactFor = (spendLamports: number, pool = POOL) => {
  const q = quoteBuy(pool, spendLamports);
  return priceImpactBps({
    poolBeforeLamports: pool,
    poolDeltaLamports: spendLamports * BUY_POOL_SHARE,
    // THE CONTINUOUS FIGURE, matching what `planBuy` feeds it. Passing the
    // floored `tokensOut` mixes the mint's 100,000-unit step into a slope
    // measurement: on this pool it reports 383 basis points for a trade whose
    // curve impact is 5, and the error shrinks as the trade grows, so it also
    // breaks monotonicity. The step is a rounding loss, not price impact.
    tokens: q.tokensOutExact,
  });
};

describe("the figure itself", () => {
  it("grows with size, monotonically", () => {
    const sizes = [1e6, 1e7, 1e8, 1e9, 5e9];
    const impacts = sizes.map((s) => impactFor(s));
    for (let i = 1; i < impacts.length; i++) {
      expect(impacts[i]).toBeGreaterThan(impacts[i - 1]);
    }
  });

  /**
   * The independent check. Not a re-run of the implementation: this derives the
   * expected figure from the curve's shape rather than from the code under test.
   */
  it("matches a quarter of the fractional pool growth, for small trades", () => {
    for (const spend of [1e7, 1e8]) {
      const growth = (spend * BUY_POOL_SHARE) / POOL;
      const approx = Math.round((growth / 4) * 10_000);
      expect(impactFor(spend)).toBe(approx);
    }
  });

  it("is smaller on a deeper pool, for the same trade", () => {
    expect(impactFor(1e9, 50_000_000_000)).toBeLessThan(impactFor(1e9, 5_000_000_000));
  });

  /**
   * The fee is not impact. Folding the 1.5% in would make every trade read as
   * at least 1.5%, which would be a number about the fee schedule wearing the
   * name of a risk measure - and would make a 0.05% impact indistinguishable
   * from a 1.55% one.
   */
  it("excludes the buy fee, which never enters the pool", () => {
    const spend = 1e7;
    const withFee = priceImpactBps({
      poolBeforeLamports: POOL,
      poolDeltaLamports: spend, // wrong on purpose: the whole spend
      tokens: quoteBuy(POOL, spend).tokensOut,
    });
    expect(impactFor(spend)).toBeLessThan(withFee);
    // 0.05% against a figure inflated by the fee.
    expect(impactFor(spend)).toBe(5);
  });

  it("returns zero where there is no price to move from, rather than Infinity", () => {
    expect(priceImpactBps({ poolBeforeLamports: 0, poolDeltaLamports: 1e9, tokens: 1000 })).toBe(0);
    expect(priceImpactBps({ poolBeforeLamports: POOL, poolDeltaLamports: 1e9, tokens: 0 })).toBe(0);
    expect(spotPricePerToken(0)).toBe(0);
  });
});

describe("assessment distinguishes three states, not two", () => {
  it("within a limit", () => {
    const a = assessPriceImpact(50, 100);
    expect(a).toMatchObject({ checked: true, withinLimit: true, exceeded: false, limitBps: 100 });
  });

  it("over a limit", () => {
    const a = assessPriceImpact(150, 100);
    expect(a).toMatchObject({ checked: true, withinLimit: false, exceeded: true });
  });

  /**
   * THE STATE A BOOLEAN WOULD LOSE. No limit configured: the impact is known,
   * nothing was compared, and `withinLimit` must be FALSE - not because the
   * trade is bad, but because nothing said it was good.
   */
  it("never checked, and does not read as fine", () => {
    for (const noLimit of [undefined, null]) {
      const a = assessPriceImpact(50, noLimit);
      expect(a.checked).toBe(false);
      expect(a.exceeded).toBe(false);
      expect(a.withinLimit).toBe(false);
      expect(a.limitBps).toBeNull();
      expect(a.impactBps).toBe(50); // still computed
    }
  });

  it("treats a zero limit as a real limit, not as absent", () => {
    // maximum_price_impact: 0 is a decision - accept nothing that moves the price.
    const a = assessPriceImpact(1, 0);
    expect(a.checked).toBe(true);
    expect(a.exceeded).toBe(true);
  });

  it("says which of the three it is, in words", () => {
    expect(describePriceImpact(assessPriceImpact(50, 100))).toMatch(/within the 1.00% maximum/);
    expect(describePriceImpact(assessPriceImpact(150, 100))).toMatch(/over the 1.00% maximum/);
    expect(describePriceImpact(assessPriceImpact(50, null))).toMatch(/No maximum is configured/);
  });
});

describe("planBuy refuses rather than flagging", () => {
  const accounts = battleAccountsFromRaw(
    new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64")),
  );
  const state = (a: number): BattleState => ({ accounts, poolLamports: { a, b: a } });
  const base = {
    battleId: buyFixture.battle_id,
    trader: buyFixture.accounts_in_order[5],
    side: "a" as const,
    slippageBps: 100,
    deadlineSeconds: 90,
    now: () => 1_700_000_000_000,
    readBattleState: async () => state(POOL),
  };

  it("builds when the impact is inside the configured maximum", async () => {
    const plan = await planBuy({ ...base, amountLamports: 1e7, maxPriceImpactBps: 100 });
    expect(plan.priceImpact).toMatchObject({ checked: true, exceeded: false, limitBps: 100 });
    expect(plan.instruction.keys).toHaveLength(13);
  });

  /**
   * PRD 56: outside configured safety limits, FAIL rather than execute. A flag
   * is something a caller can ignore, and an ignorable limit is not a limit -
   * so there is no transaction to ignore it with.
   */
  it("throws, producing no transaction at all, when over the maximum", async () => {
    await expect(planBuy({ ...base, amountLamports: 1e9, maxPriceImpactBps: 100 }))
      .rejects.toThrow(PriceImpactExceededError);
    await expect(planBuy({ ...base, amountLamports: 1e9, maxPriceImpactBps: 100 }))
      .rejects.toThrow(/exceeds the configured maximum/);
  });

  /**
   * No limit means no refusal - and the plan says nothing checked it. This is
   * the state production is in today, because PRD 16's registry is built and
   * not yet maintained, so there is nowhere for a limit to come from.
   */
  it("builds without a limit, and marks the impact unchecked", async () => {
    const plan = await planBuy({ ...base, amountLamports: 1e9 });
    expect(plan.priceImpact.impactBps).toBeGreaterThan(100);
    expect(plan.priceImpact.checked).toBe(false);
    expect(plan.priceImpact.withinLimit).toBe(false);
    expect(plan.instruction).toBeTruthy();
  });

  /**
   * The impact must come from the same read as the floor. One computed from a
   * stale pool would be the defect #300 fixed, wearing a different name.
   */
  it("computes the impact from the fresh read, not a stale pool", async () => {
    let pool = POOL;
    const readBattleState = async () => state(pool);
    const first = await planBuy({ ...base, amountLamports: 1e8, readBattleState });
    pool = POOL * 10;
    const second = await planBuy({ ...base, amountLamports: 1e8, readBattleState });
    expect(second.priceImpact.impactBps).toBeLessThan(first.priceImpact.impactBps);
  });
});
