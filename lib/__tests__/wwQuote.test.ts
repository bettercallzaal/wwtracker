/**
 * The quote, replayed against real trades rather than against itself.
 *
 * `ww-trades-replay.json` is 1,803 real buys and sells from the 40 busiest
 * battles in the committed chain snapshot. The replay reconstructs pool state
 * trade by trade and compares each predicted delta to what the chain recorded.
 *
 * The assertions are ERROR BANDS, not equalities, and that is the honest shape
 * for a model: a test demanding exactness would either fail or force a fudge
 * factor fitted to this fixture. The bands are set at the measured values with
 * a little headroom, so they fail if the model degrades and pass if it holds.
 */
import { describe, expect, it } from "vitest";
import replay from "../__fixtures__/ww-trades-replay.json";
import {
  BUY_POOL_SHARE,
  CURVE_K,
  SUPPLY_QUANTUM,
  floorToQuantum,
  poolAtSupply,
  quoteBuy,
  quoteSell,
  feeSplit,
  supplyAtPool,
  withSlippage,
  solToLamports,
} from "../ww/quote";

interface Event {
  kind: "buy" | "sell";
  side: "a" | "b";
  lamports: number;
  tokens: Record<string, number>;
  slot: number;
}
const battles = replay.battles as unknown as Record<string, Event[]>;

/** actual / predicted for every trade in the fixture. */
function replayRatios() {
  const buys: number[] = [];
  const sells: number[] = [];
  for (const events of Object.values(battles)) {
    const pool: Record<string, number> = { a: 0, b: 0 };
    for (const e of [...events].sort((x, y) => x.slot - y.slot)) {
      const delta = e.tokens[e.side] ?? 0;
      if (e.kind === "buy") {
        if (pool[e.side] >= 0 && delta > 0) {
          const q = quoteBuy(pool[e.side], e.lamports);
          if (q.tokensOut > 0) buys.push(delta / q.tokensOut);
          pool[e.side] = q.poolAfterLamports;
        } else {
          pool[e.side] += e.lamports * BUY_POOL_SHARE;
        }
      } else {
        const tokens = Math.abs(delta);
        const supply = supplyAtPool(pool[e.side]);
        if (tokens > 0 && tokens <= supply && e.lamports > 0) {
          const q = quoteSell(pool[e.side], tokens);
          // AGAINST THE GROSS, and this is the whole bug in one line. A sell
          // row's `lamports` is what LEFT THE VAULT, not what the trader
          // received - they differ by the 1.5% fee. Comparing the fixture's
          // gross to `lamportsOut`, which is now net, would restate the same
          // mistake that made this module claim sells were fee-free.
          if (q.grossLamports > 0) sells.push(e.lamports / q.grossLamports);
          pool[e.side] = q.poolAfterLamports;
        }
      }
    }
  }
  return { buys, sells };
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const shareWithin = (xs: number[], tol: number) =>
  xs.filter((x) => Math.abs(x - 1) <= tol).length / xs.length;

describe("the curve against 1,803 real trades", () => {
  const { buys, sells } = replayRatios();

  it("replays enough trades that the bands mean something", () => {
    // Guards the whole file: if the fixture stopped loading, every band below
    // would pass vacuously on an empty array.
    expect(buys.length).toBeGreaterThan(900);
    expect(sells.length).toBeGreaterThan(300);
  });

  /**
   * Measured on this fixture: median 0.9998, 84.9% within 0.5%, 97.5% within 2%.
   * The bands sit just under those.
   *
   * The whole population does BETTER - 89.9% within 0.5% across all 897 battles
   * with five or more trades. This fixture is the 40 BUSIEST battles, where more
   * trades mean more accumulated pool drift in the replay, so it is a
   * pessimistic sample rather than a representative one. That is the right
   * direction for a guard to be biased in, and it is why the band is 84 and not
   * the 89 the full population would support.
   */
  it("predicts buys to a median within 0.5%, and 84% of them within 0.5%", () => {
    expect(Math.abs(median(buys) - 1)).toBeLessThan(0.005);
    expect(shareWithin(buys, 0.005)).toBeGreaterThan(0.84);
    expect(shareWithin(buys, 0.02)).toBeGreaterThan(0.95);
  });

  it("predicts sells to a median within 0.5%, and 90% of them within 0.5%", () => {
    expect(Math.abs(median(sells) - 1)).toBeLessThan(0.005);
    expect(shareWithin(sells, 0.005)).toBeGreaterThan(0.9);
  });

  /**
   * THE POOL TAKES NO FEE. THE TRADER DOES. Both are true and confusing them is
   * what made this module wrong for two days.
   *
   * The ratios above are pool movement against pool movement, so applying the
   * fee to them must break the fit - if it did not, the fixture's `lamports`
   * would be the trader's proceeds rather than the vault's release, and the
   * whole replay would be measuring something else.
   */
  it("the pool moves by the full curve amount, with no fee applied to it", () => {
    const withFee = sells.map((r) => r / BUY_POOL_SHARE);
    expect(Math.abs(median(withFee) - 1)).toBeGreaterThan(0.01);
    expect(shareWithin(withFee, 0.005)).toBeLessThan(0.05);
  });
});

describe("the curve's own algebra", () => {
  it("round-trips supply and pool", () => {
    for (const pool of [1e6, 5e8, 1e9, 3.3e9]) {
      expect(poolAtSupply(supplyAtPool(pool))).toBeCloseTo(pool, 0);
    }
  });

  it("is zero at zero and never negative", () => {
    expect(supplyAtPool(0)).toBe(0);
    expect(poolAtSupply(0)).toBe(0);
    expect(supplyAtPool(-1)).toBe(0);
  });

  it("uses the K the PROGRAM uses, which is round", () => {
    // Was 4.993e8, "fitted against all 1,643 battles". Measured against the
    // deployed program on 2026-09-20 instead: nine buys from an empty pool and
    // eight incremental buys all reproduce exactly at 5e8 with the step below.
    // A fitted constant was standing in for arithmetic nobody had read.
    expect(CURVE_K).toBe(5e8);
    expect(SUPPLY_QUANTUM).toBe(100_000);
  });

  it("mints in whole steps, and floors each TRADE rather than the total", () => {
    // The distinction cost a round to find. Flooring the running total is right
    // for a first buy and wrong for every buy after it, by exactly one step.
    const first = quoteBuy(0, 10_000_000);
    expect(first.tokensOut % SUPPLY_QUANTUM).toBe(0);
    expect(first.tokensOut).toBe(70_100_000); // read off the program

    // A SECOND buy of 0.001 SOL onto that pool: the program minted 3,400,000.
    expect(quoteBuy(9_850_000, 1_000_000).tokensOut).toBe(3_400_000);
    // Flooring the running total instead says 3,500,000 - one step too many,
    // which is exactly how the wrong model failed, five times in eight.
    expect(floorToQuantum(supplyAtPool(9_850_000 + 985_000)) - 70_100_000).toBe(3_500_000);

    // A different pair off the same table, to pin it at another size.
    expect(quoteBuy(985_000, 100_000).tokensOut).toBe(1_000_000);
  });

  it("keeps the continuous figure for price impact, separately", () => {
    const q = quoteBuy(2e9, 1e7);
    expect(q.tokensOutExact).toBeGreaterThanOrEqual(q.tokensOut);
    expect(q.tokensOutExact - q.tokensOut).toBeLessThan(SUPPLY_QUANTUM);
  });
});

describe("quoteBuy", () => {
  it("charges the 1.5% fee and puts the rest in the pool", () => {
    const q = quoteBuy(1e9, solToLamports(1));
    expect(q.feeLamports).toBeCloseTo(15_000_000, 0);
    expect(q.poolAfterLamports).toBeCloseTo(1e9 + 985_000_000, 0);
  });

  it("gives fewer tokens per SOL as the pool grows - the curve is concave", () => {
    const small = quoteBuy(1e8, solToLamports(1));
    const large = quoteBuy(1e10, solToLamports(1));
    expect(large.tokensOut).toBeLessThan(small.tokensOut);
    expect(large.effectivePricePerToken).toBeGreaterThan(small.effectivePricePerToken);
  });

  it("refuses a non-positive spend", () => {
    expect(() => quoteBuy(1e9, 0)).toThrow(/positive/);
    expect(() => quoteBuy(1e9, -1)).toThrow(/positive/);
  });
});

describe("quoteSell", () => {
  it("costs the fee TWICE over a round trip, once in and once out", () => {
    // FROM AN EMPTY POOL, so the buyer's tokens ARE the whole minted supply and
    // the sell can be priced against the real thing rather than the fallback.
    const pool = 0;
    const spend = solToLamports(0.5);
    const bought = quoteBuy(pool, spend);
    const back = quoteSell(bought.poolAfterLamports, bought.tokensOut, bought.tokensOut);
    // In and straight back out, with no price move. The fee is charged on each
    // crossing, so the vault returns very nearly what the buy put in.
    expect(back.grossLamports).toBeCloseTo(spend * BUY_POOL_SHARE, -6);

    // NEARLY, AND NOT EXACTLY. The buyer was minted a whole number of steps,
    // so a little of what they paid in bought no token and cannot be sold
    // back. That shortfall is bounded by one step's worth of pool and does NOT
    // scale with the trade - it is a fixed cost of entering, not a rate.
    const shortfall = spend * BUY_POOL_SHARE - back.grossLamports;
    expect(shortfall).toBeGreaterThan(0);
    // One step's worth of pool at this point on the curve, and no more.
    const oneStep = poolAtSupply(bought.tokensOut + SUPPLY_QUANTUM) - poolAtSupply(bought.tokensOut);
    expect(shortfall).toBeLessThan(oneStep);

    // A round trip therefore costs the fee twice plus that crumb: a hair OVER
    // 3% here, where the older model said a hair under. The fee half of that
    // is 2.98% and is exact; the rest is the step.
    expect(1 - back.lamportsOut / spend).toBeGreaterThan(0.0298);
    expect(1 - back.lamportsOut / spend).toBeLessThan(0.031);
  });

  it("reports gross, net and fee consistently", () => {
    const q = quoteSell(2e9, supplyAtPool(2e9) * 0.1);
    expect(q.lamportsOut + q.feeLamports).toBeCloseTo(q.grossLamports, 6);
    expect(q.feeLamports / q.grossLamports).toBeCloseTo(0.015, 9);
  });

  /**
   * The regression guard. `lamportsOut` was the gross until 2026-09-19, which
   * overstated proceeds by 1.5% and made any slippage tolerance under that
   * impossible to satisfy. If someone restores the old behaviour this fails.
   */
  it("never returns the gross as the trader's proceeds", () => {
    const q = quoteSell(2e9, supplyAtPool(2e9) * 0.1);
    expect(q.lamportsOut).toBeLessThan(q.grossLamports);
    expect(withSlippage(q.lamportsOut, 100)).toBeLessThan(q.grossLamports * BUY_POOL_SHARE);
  });

  it("splits the fee 67/33 to artist and platform", () => {
    const q = quoteSell(2e9, supplyAtPool(2e9) * 0.1);
    const { artistLamports, platformLamports } = feeSplit(q.feeLamports);
    expect(artistLamports + platformLamports).toBeCloseTo(q.feeLamports, 6);
    expect(artistLamports / q.feeLamports).toBeCloseTo(0.67, 9);
  });

  it("refuses to sell more than the side's whole supply", () => {
    expect(() => quoteSell(1e9, supplyAtPool(1e9) * 2)).toThrow(/whole supply/);
  });

  it("refuses a non-positive amount", () => {
    expect(() => quoteSell(1e9, 0)).toThrow(/positive/);
  });
});

describe("withSlippage", () => {
  it("rounds down, because a floor rounded up rejects trades it should allow", () => {
    expect(withSlippage(1000, 100)).toBe(990);
    expect(withSlippage(999, 100)).toBe(989); // 989.01 floored
  });

  it("0 bps is the estimate itself, 10000 bps is zero protection at the far end", () => {
    expect(withSlippage(1234, 0)).toBe(1234);
    expect(withSlippage(1234, 10_000)).toBe(0);
  });

  it("refuses a tolerance outside the range rather than clamping it", () => {
    expect(() => withSlippage(100, -1)).toThrow(/out of range/);
    expect(() => withSlippage(100, 10_001)).toThrow(/out of range/);
  });
});
