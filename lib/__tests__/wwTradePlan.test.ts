/**
 * The slippage floor has to come from a pool read now, not at page load.
 *
 * PRD section 56's first requirement is "fresh quote". Scoring it against the
 * code on 2026-09-18 found it was not: `TradeWidget` read the pools once in its
 * mount effect and computed `minTokensOut` from that, so the trader's only
 * protection against the price moving was calculated against the price whenever
 * they happened to open the tab.
 *
 * THE TEST THAT MATTERS IS "recomputes the floor when the pool has moved". It
 * is written so the OLD behaviour fails it: a pool that changes between two
 * plans must produce two different floors. An implementation that captured the
 * pool once returns the same number twice and the test goes red.
 *
 * Nothing here needs a network, and that is deliberate - the read is an
 * argument, so its timing is testable. Order of operations inside a React
 * callback is not.
 */
import { describe, expect, it, vi } from "vitest";
import { planBuy, planSell, poolMoveBps, type BattleState } from "../ww/tradePlan";
import { quoteBuy, quoteSell, supplyAtPool, withSlippage } from "../ww/quote";
import { PriceImpactExceededError } from "../ww/priceImpact";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";
import { battleAccountsFromRaw } from "../ww/instructions";
import dustFixture from "../__fixtures__/ww-dust-boundary.json";

const accounts = battleAccountsFromRaw(
  new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64")),
);
const trader = buyFixture.accounts_in_order[5];
const battleId = buyFixture.battle_id;

const state = (a: number, b = 1_000_000_000): BattleState => ({
  accounts,
  poolLamports: { a, b },
});

const base = {
  battleId,
  trader,
  side: "a" as const,
  amountLamports: 10_000_000,
  slippageBps: 100,
  deadlineSeconds: 90,
  now: () => 1_700_000_000_000,
};

describe("the floor comes from a read, every time", () => {
  it("reads the battle state on every plan, not once", async () => {
    const readBattleState = vi.fn(async () => state(5_000_000_000));
    await planBuy({ ...base, readBattleState });
    await planBuy({ ...base, readBattleState });
    await planBuy({ ...base, readBattleState });
    expect(readBattleState).toHaveBeenCalledTimes(3);
  });

  /**
   * THE RED CONTROL FOR THE ORIGINAL DEFECT. The old widget captured the pool
   * in component state at mount; building twice produced the same floor no
   * matter what the pool did. Here the pool grows tenfold between plans and the
   * floor must follow it.
   */
  it("recomputes the floor when the pool has moved", async () => {
    let pool = 5_000_000_000;
    const readBattleState = async () => state(pool);

    const first = await planBuy({ ...base, readBattleState });
    pool = 50_000_000_000;
    const second = await planBuy({ ...base, readBattleState });

    expect(second.poolLamports).toBe(50_000_000_000);
    expect(second.minTokensOut).not.toBe(first.minTokensOut);
    // A deeper pool means the same SOL buys fewer tokens on this curve, so the
    // floor must go DOWN. Asserting the direction, not just "different" - a
    // floor that moved the wrong way is also different.
    expect(second.minTokensOut).toBeLessThan(first.minTokensOut);
  });

  it("puts that floor in the instruction, not just in the returned object", async () => {
    const readBattleState = async () => state(5_000_000_000);
    const plan = await planBuy({ ...base, readBattleState });
    // minTokensOut is bytes 17..25 of the buy instruction data, little-endian.
    const data = plan.instruction.data;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    expect(Number(view.getBigUint64(17, true))).toBe(plan.minTokensOut);
  });

  it("agrees with quote.ts rather than reimplementing the curve", async () => {
    const pool = 3_210_000_000;
    const plan = await planBuy({ ...base, readBattleState: async () => state(pool) });
    const expected = quoteBuy(pool, base.amountLamports);
    expect(plan.estimatedTokensOut).toBe(expected.tokensOut);
    expect(plan.feeLamports).toBe(expected.feeLamports);
    expect(plan.minTokensOut).toBe(withSlippage(expected.tokensOut, base.slippageBps));
  });

  it("reads the side being bought, not always side A", async () => {
    const readBattleState = async () => state(5_000_000_000, 99_000_000_000);
    const a = await planBuy({ ...base, side: "a", readBattleState });
    const b = await planBuy({ ...base, side: "b", readBattleState });
    expect(a.poolLamports).toBe(5_000_000_000);
    expect(b.poolLamports).toBe(99_000_000_000);
  });

  /**
   * A tighter tolerance must produce a higher floor. Getting this backwards
   * would leave every trade unprotected while the UI showed a slippage setting
   * the person had deliberately chosen.
   */
  it("raises the floor as the tolerance tightens", async () => {
    const readBattleState = async () => state(5_000_000_000);
    const loose = await planBuy({ ...base, slippageBps: 300, readBattleState });
    const tight = await planBuy({ ...base, slippageBps: 50, readBattleState });
    expect(tight.minTokensOut).toBeGreaterThan(loose.minTokensOut);
  });

  it("dates the deadline from now, so a stale plan expires", async () => {
    const readBattleState = async () => state(5_000_000_000);
    const plan = await planBuy({ ...base, readBattleState });
    const data = plan.instruction.data;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const deadline = Number(view.getBigInt64(25, true));
    expect(deadline).toBe(Math.floor(base.now() / 1000) + 90);
  });
});

describe("poolMoveBps", () => {
  it("reports the move so a person can be told their quote changed", () => {
    expect(poolMoveBps(1_000_000, 1_100_000)).toBe(1000); // +10%
    expect(poolMoveBps(1_000_000, 900_000)).toBe(-1000);
    expect(poolMoveBps(1_000_000, 1_000_000)).toBe(0);
  });

  /**
   * A move from an empty pool has no meaningful ratio. Infinity in a UI is
   * worse than saying nothing moved, and NaN is worse still because it compares
   * false against every threshold a caller might set.
   */
  it("returns 0 rather than Infinity when there was nothing to move from", () => {
    expect(poolMoveBps(0, 5_000_000)).toBe(0);
    expect(poolMoveBps(-1, 5_000_000)).toBe(0);
  });
});

/**
 * planSell is not a mirror of planBuy, and these pin the two places it differs.
 * Both differences are consequences of where the 1.5% fee sits, which this
 * estate had wrong until 2026-09-19.
 */
describe("planSell", () => {
  const POOL = 5_000_000_000;
  const tokens = Math.floor(supplyAtPool(POOL) * 0.05);
  const sellBase = {
    battleId,
    trader,
    side: "a" as const,
    amountTokens: tokens,
    slippageBps: 100,
    deadlineSeconds: 60,
    now: () => 1_700_000_000_000,
  };

  it("reads the battle fresh on every plan, like planBuy", async () => {
    const readBattleState = vi.fn(async () => state(POOL));
    await planSell({ ...sellBase, readBattleState });
    await planSell({ ...sellBase, readBattleState });
    expect(readBattleState).toHaveBeenCalledTimes(2);
  });

  it("puts the floor on the NET, not on what leaves the vault", async () => {
    const plan = await planSell({ ...sellBase, readBattleState: async () => state(POOL) });
    const q = quoteSell(POOL, tokens);
    expect(plan.estimatedLamportsOut).toBe(q.lamportsOut);
    expect(plan.minSolOut).toBe(withSlippage(q.lamportsOut, 100));
    // The bug this module could not have been written against: a floor built on
    // the gross is one the program can never clear.
    expect(plan.minSolOut).toBeLessThan(plan.grossLamports);
    expect(plan.grossLamports).toBeGreaterThan(plan.estimatedLamportsOut);
  });

  it("reports gross, net and fee that add up", async () => {
    const plan = await planSell({ ...sellBase, readBattleState: async () => state(POOL) });
    expect(plan.estimatedLamportsOut + plan.feeLamports).toBeCloseTo(plan.grossLamports, 6);
  });

  it("measures price impact on the GROSS, because that is what leaves the pool", async () => {
    const plan = await planSell({ ...sellBase, readBattleState: async () => state(POOL) });
    // If impact were computed on the net it would be 1.5% smaller. Recompute
    // both ways and require the plan to match the gross one.
    const q = quoteSell(POOL, tokens);
    const impactOnGross = Math.abs(plan.priceImpact.impactBps);
    expect(impactOnGross).toBeGreaterThan(0);
    const ratio = q.grossLamports / q.lamportsOut;
    expect(ratio).toBeCloseTo(1 / 0.985, 6);
  });

  it("moves the floor when the pool moves between reads", async () => {
    let pool = POOL;
    const readBattleState = async () => state(pool);
    const first = await planSell({ ...sellBase, readBattleState });
    pool = POOL * 2;
    const second = await planSell({ ...sellBase, readBattleState });
    expect(second.minSolOut).not.toBe(first.minSolOut);
  });

  it("refuses rather than flags when the impact limit is exceeded", async () => {
    await expect(
      planSell({
        ...sellBase,
        amountTokens: Math.floor(supplyAtPool(POOL) * 0.9),
        maxPriceImpactBps: 10,
        readBattleState: async () => state(POOL),
      }),
    ).rejects.toBeInstanceOf(PriceImpactExceededError);
  });

  it("says impact was not checked when no limit is configured", async () => {
    const plan = await planSell({ ...sellBase, readBattleState: async () => state(POOL) });
    expect(plan.priceImpact.checked).toBe(false);
    expect(plan.priceImpact.exceeded).toBe(false);
  });
});

/**
 * The front door, not the module. Every other test in this repo imports
 * `../ww/<module>` directly, which is why two gaps survived 875 passing tests:
 * `planSell` was never exported and there was no way to build a `BattleState`
 * without hand-decoding byte offsets. Both were found by writing a script that
 * imports only what an integrator can reach.
 */
describe("the exported surface, as an integrator sees it", () => {
  it("exports both planners, not just the buy one", async () => {
    const sdk = await import("../ww");
    expect(typeof sdk.planBuy).toBe("function");
    expect(typeof sdk.planSell).toBe("function");
  });

  it("can build a BattleState without knowing a byte offset", async () => {
    const sdk = await import("../ww");
    expect(typeof sdk.battleStateFromRaw).toBe("function");
    const raw = new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64"));
    const state = sdk.battleStateFromRaw(raw);
    expect(state.accounts.artistA).toBe(accounts.artistA);
    expect(typeof state.poolLamports.a).toBe("number");
    expect(typeof state.poolLamports.b).toBe("number");
  });

  it("refuses an account too short to hold the pools, and says what is needed", async () => {
    const sdk = await import("../ww");
    expect(() => sdk.battleStateFromRaw(new Uint8Array(140))).toThrow(/228 needed/);
  });

  it("feeds planBuy directly, which is the whole point of it existing", async () => {
    const sdk = await import("../ww");
    const raw = new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64"));
    const plan = await sdk.planBuy({
      ...base,
      readBattleState: async () => sdk.battleStateFromRaw(raw),
    });
    expect(plan.instruction.keys.length).toBeGreaterThan(0);
  });
});

describe("the headroom window, where the program mints and our floor reads 0", () => {
  // The measured boundary: the program's smallest accepted spend at this pool
  // mints 100,000 tokens while quoteBuy reads 99,998.8 exact and 0 floored.
  // The dust check lets it through (correctly); the slippage floor must not
  // then hand 0 to buyFloor.
  const pool = dustFixture.poolBeforeLamports;
  const spend = dustFixture.smallestAcceptedSpend;

  it("is inside the window the fixture measured", () => {
    const q = quoteBuy(pool, spend);
    expect(q.tokensOut).toBe(0);
    expect(q.tokensOutExact).toBeGreaterThanOrEqual(100_000 - 16);
    expect(q.tokensOutExact).toBeLessThan(100_000);
  });

  it("plans the buy with a floor of 1 instead of refusing it", async () => {
    const plan = await planBuy({
      ...base,
      amountLamports: spend,
      readBattleState: async () => state(pool),
    });
    expect(plan.minTokensOut).toBe(1);
    expect(plan.estimatedTokensOut).toBe(0);
  });
});

/**
 * The minted supply reaches the sell quote. Until 2026-09-21 `planSell` called
 * `quoteSell(pool, tokens)` with no third argument, so every plan priced off
 * the CURVE's supply at that pool - an upper bound that overstates proceeds on
 * a battle with many trades, by about 10 lamports on the measured case and by
 * more the longer a battle trades. quote.ts said to pass the minted supply
 * "whenever you have the account, which is whenever you are about to sell", and
 * the planner had the account and did not pass it.
 */
describe("planSell prices off the minted supply when the state carries it", () => {
  const POOL = 5_000_000_000;
  const tokens = 1_000_000;
  const minted = Math.floor(supplyAtPool(POOL) * 0.996);
  const sellBase = {
    battleId,
    trader,
    side: "a" as const,
    amountTokens: tokens,
    slippageBps: 100,
    deadlineSeconds: 60,
    now: () => 1_700_000_000_000,
  };

  it("uses mintedSupply for the side being sold", async () => {
    const plan = await planSell({
      ...sellBase,
      readBattleState: async () => ({ ...state(POOL), mintedSupply: { a: minted, b: minted * 2 } }),
    });
    expect(plan.estimatedLamportsOut).toBe(quoteSell(POOL, tokens, minted).lamportsOut);
    expect(plan.estimatedLamportsOut).not.toBe(quoteSell(POOL, tokens).lamportsOut);
    expect(plan.supplySource).toBe("minted");
  });

  it("still plans from the curve when the state has no supply, and says which it used", async () => {
    const plan = await planSell({ ...sellBase, readBattleState: async () => state(POOL) });
    expect(plan.estimatedLamportsOut).toBe(quoteSell(POOL, tokens).lamportsOut);
    expect(plan.supplySource).toBe("curve");
  });

  it("battleStateFromRaw carries the minted supplies from bytes 196 and 204", async () => {
    const { battleStateFromRaw } = await import("../ww/tradePlan");
    const raw = new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64"));
    const s = battleStateFromRaw(raw);
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    expect(s.mintedSupply).toEqual({
      a: Number(dv.getBigUint64(196, true)),
      b: Number(dv.getBigUint64(204, true)),
    });
  });
});
