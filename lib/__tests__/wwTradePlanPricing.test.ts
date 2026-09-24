/**
 * The quote a trader is shown, and the floor that goes in the instruction,
 * must come from the exact curve.
 *
 * A buy is minted from the pool the STORED SUPPLY implies, not the pool the
 * vault holds. Measured exact on 127 real buys; the pool-based form misses
 * about one in five, always LOW by one 100,000-token step. Low means it
 * under-promises, so nothing reverted - the number on the screen was simply
 * wrong.
 */
import { describe, expect, it } from "vitest";
import { planBuy } from "../ww/tradePlan";
import { quoteBuy, quoteBuyAtSupply } from "../ww/quote";

/** Battle 1790215514, side B, second buy: the hand-verified case. */
const SUPPLY = 156_900_000;
const POOL = 49_250_000;
const SPEND = 50_000_000;
const PROGRAM_MINTED = 65_000_000;

const accounts = {
  artistA: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
  artistB: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
  wavewarzWallet: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
};

const plan = (mintedSupply?: { a: number; b: number }) =>
  planBuy({
    battleId: 1_790_215_514,
    trader: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
    side: "b",
    amountLamports: SPEND,
    slippageBps: 100,
    deadlineSeconds: 300,
    readBattleState: async () => ({
      accounts,
      poolLamports: { a: 0, b: POOL },
      ...(mintedSupply ? { mintedSupply } : {}),
    }),
  });

describe("the two forms differ on this exact trade", () => {
  /**
   * THE POSITIVE CONTROL. If these ever agree, every assertion below passes
   * for the wrong reason and the switch proves nothing.
   */
  it("they disagree by one step, and the exact one is what the program minted", () => {
    expect(quoteBuy(POOL, SPEND).tokensOut).toBe(64_900_000);
    expect(quoteBuyAtSupply(SUPPLY, SPEND).tokensOut).toBe(PROGRAM_MINTED);
  });
});

describe("planBuy", () => {
  it("prices off the stored supply when the state carries it", async () => {
    const p = await plan({ a: 0, b: SUPPLY });
    expect(p.estimatedTokensOut).toBe(PROGRAM_MINTED);
    expect(p.pricedFrom).toBe("minted");
  });

  it("says which form it used, so nobody has to guess which number they hold", async () => {
    const withSupply = await plan({ a: 0, b: SUPPLY });
    const without = await plan();
    expect(withSupply.pricedFrom).toBe("minted");
    expect(without.pricedFrom).toBe("pool");
  });

  /**
   * The fallback is a slightly conservative quote rather than a refusal:
   * `mintedSupply` is optional on `BattleState`, and a caller that cannot
   * supply it should still get a plan.
   */
  it("falls back to the pool form rather than failing, and it is the LOW one", async () => {
    const without = await plan();
    expect(without.estimatedTokensOut).toBe(64_900_000);
    expect(without.estimatedTokensOut).toBeLessThan(PROGRAM_MINTED);
  });

  it("computes the slippage floor from whichever estimate it used", async () => {
    const p = await plan({ a: 0, b: SUPPLY });
    // 1% below the exact estimate, floored - and a floor derived from an
    // exact number is the one the program will accept.
    expect(p.minTokensOut).toBe(Math.floor((PROGRAM_MINTED * 9_900) / 10_000));
    expect(p.minTokensOut).toBeLessThan(p.estimatedTokensOut);
  });
});
