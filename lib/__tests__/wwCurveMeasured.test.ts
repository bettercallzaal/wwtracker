/**
 * The bonding curve, against the deployed program rather than against a fit.
 *
 * `CURVE_K` was 4.993e8, described as "fitted in the protocol repo against all
 * 1,643 battles", and the module's own comment four lines above it warned about
 * "a constant with no meaning that happens to fit". It was that. The residual it
 * left was even diagnosed correctly - "consistent with the program flooring
 * integer division" - and then modelled by bending K instead of by flooring.
 *
 * These 22 rows were captured on 2026-09-20 by simulating buys and sells against
 * the live program and reading the battle account's post-state back. Nothing was
 * signed and nothing was sent. Every row must reproduce EXACTLY - no tolerance,
 * no band - because the program's arithmetic is integer and ours now claims to
 * be the same arithmetic. A tolerance here would hide the next wrong constant
 * exactly as the last one was hidden.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-curve-measured.json";
import boundaryFixture from "../__fixtures__/ww-dust-boundary.json";
import { BUY_POOL_SHARE, SUPPLY_QUANTUM, minimumSpendLamports, poolAtSupply, quoteBuy, quoteSell } from "../ww/quote";

type FirstBuy = { spendLamports: number; poolAfter: number; mintedSupply: number };
type Incremental = { firstSpend: number; secondSpend: number; poolBefore: number;
  supplyBefore: number; tokensMinted: number; poolAfter: number };
type Sell = { poolBefore: number; supplyBefore: number; tokensSold: number;
  grossLamports: number; supplyAfter: number };
const f = fixture as unknown as { firstBuys: FirstBuy[]; incremental: Incremental[]; sells: Sell[] };
const boundary = boundaryFixture as unknown as {
  poolBeforeLamports: number; smallestAcceptedSpend: number; largestRejectedSpend: number;
  tokensMintedAtSmallestAccepted: number; rejectionError: string;
};

it("has rows to check, so nothing below passes vacuously", () => {
  expect(f.firstBuys.length).toBeGreaterThanOrEqual(9);
  expect(f.incremental.length).toBeGreaterThanOrEqual(8);
  expect(f.sells.length).toBeGreaterThanOrEqual(5);
});

describe("a first buy, into an empty pool", () => {
  it("predicts the minted supply exactly, at every size", () => {
    for (const row of f.firstBuys) {
      expect(quoteBuy(0, row.spendLamports).tokensOut).toBe(row.mintedSupply);
    }
  });

  it("puts 98.5% of the spend into the pool, to the lamport", () => {
    for (const row of f.firstBuys) {
      expect(row.poolAfter).toBe(Math.round(row.spendLamports * BUY_POOL_SHARE));
    }
  });

  it("mints only whole steps", () => {
    for (const row of f.firstBuys) expect(row.mintedSupply % SUPPLY_QUANTUM).toBe(0);
  });
});

describe("a later buy, onto a pool that already has one", () => {
  /**
   * THE ROWS THAT KILLED THE WRONG MODEL. Flooring the running supply matches
   * every first buy above and misses five of these eight by exactly one step,
   * always predicting too many. Both models agree when the pool starts empty,
   * which is why a check built only from first buys would have shipped it.
   */
  it("predicts the tokens minted exactly", () => {
    for (const row of f.incremental) {
      expect(quoteBuy(row.poolBefore, row.secondSpend).tokensOut).toBe(row.tokensMinted);
    }
  });

  it("is a floored DELTA, so the running total falls behind the curve", () => {
    for (const row of f.incremental) {
      const exact = quoteBuy(row.poolBefore, row.secondSpend).tokensOutExact;
      expect(row.tokensMinted).toBeLessThanOrEqual(exact);
      expect(exact - row.tokensMinted).toBeLessThan(SUPPLY_QUANTUM);
    }
  });
});

describe("selling", () => {
  it("predicts the lamports leaving the vault exactly, given the minted supply", () => {
    for (const row of f.sells) {
      const q = quoteSell(row.poolBefore, row.tokensSold, row.supplyBefore);
      expect(Math.round(q.grossLamports)).toBe(row.grossLamports);
    }
  });

  it("burns exactly the tokens sold", () => {
    for (const row of f.sells) {
      expect(row.supplyAfter).toBe(row.supplyBefore - row.tokensSold);
    }
  });

  /**
   * The defect this replaced, stated as a number rather than as a warning.
   */
  it("would have overstated a small sell by more than 20% priced off the pool", () => {
    const small = f.sells.reduce((a, b) => (a.tokensSold < b.tokensSold ? a : b));
    const wrong = small.poolBefore - poolAtSupply(small.supplyBefore - small.tokensSold);
    expect(wrong / small.grossLamports - 1).toBeGreaterThan(0.2);
    // And the error is a fixed number of lamports, so it vanishes on a large
    // sell and is worst for the smallest seller - the shape least likely to be
    // noticed by whoever tests it once.
    const big = f.sells.reduce((a, b) => (a.tokensSold > b.tokensSold ? a : b));
    const wrongBig = big.poolBefore - poolAtSupply(big.supplyBefore - big.tokensSold);
    expect(wrongBig - big.grossLamports).toBeCloseTo(wrong - small.grossLamports, -1);
    expect(wrongBig / big.grossLamports - 1).toBeLessThan(0.01);
  });
});

/**
 * The dust floor, which quantization created and nothing warned about.
 */
describe("a trade too small to mint a step", () => {
  it("quotes zero, which is what the program refuses on", () => {
    // 1,000 lamports onto the 9,850,000 pool a 0.01 SOL buy leaves. Simulated
    // 2026-09-20: InvalidCalculation, and the program took nothing.
    expect(quoteBuy(9_850_000, 1_000).tokensOut).toBe(0);
    expect(quoteBuy(9_850_000, 1_000).tokensOutExact).toBeGreaterThan(0);
  });

  /**
   * CHECKED AGAINST THE PROGRAM'S BOUNDARY, NOT AGAINST OUR OWN QUOTE.
   *
   * This used to assert that `quoteBuy` mints at the minimum we name - our
   * model agreeing with our model. It passed while the minimum was four
   * lamports HIGHER than the program's, which would tell a caller a trade is
   * impossible when the chain would take it.
   */
  it("never names a minimum above the one the program enforces", () => {
    // Bisected against the deployed program: 287,167 accepted, 287,166 not.
    expect(minimumSpendLamports(boundary.poolBeforeLamports))
      .toBeLessThanOrEqual(boundary.smallestAcceptedSpend);
  });

  it("stays close to it rather than naming a uselessly small number", () => {
    // Safe is not the same as unhelpful: within 0.1% of the real boundary.
    const named = minimumSpendLamports(boundary.poolBeforeLamports);
    expect(named).toBeGreaterThan(boundary.smallestAcceptedSpend * 0.999);
  });

  it("is positive at every pool size, including an empty one", () => {
    for (const pool of [0, 9_850_000, 1e9, 2e10]) {
      expect(minimumSpendLamports(pool)).toBeGreaterThan(0);
    }
  });

  it("RISES with the pool, which is why it works when you test it", () => {
    // The trap: 0.001 SOL is fine on a young battle and mints nothing on a
    // popular one. A limit that only bites at scale is the worst kind.
    const young = minimumSpendLamports(0);
    const busy = minimumSpendLamports(2e10);
    expect(busy).toBeGreaterThan(young * 1000);
    expect(quoteBuy(2e10, 1_000_000).tokensOut).toBe(0); // 0.001 SOL, 20 SOL pool
    expect(quoteBuy(0, 1_000_000).tokensOut).toBeGreaterThan(0);
  });
});

/**
 * The size of our disagreement with the program, stated rather than hidden.
 */
describe("where our curve and the program part company", () => {
  it("has a boundary measured on both sides", () => {
    expect(boundary.smallestAcceptedSpend - boundary.largestRejectedSpend).toBe(1);
    expect(boundary.tokensMintedAtSmallestAccepted).toBe(SUPPLY_QUANTUM);
    expect(boundary.rejectionError).toBe("InvalidCalculation");
  });

  it("disagrees by at most a few token units in a hundred thousand", () => {
    // Our raw delta at the program's smallest accepted spend. The program mints
    // a full step here; we read just under one. That gap is the whole of our
    // inexactness, and it is why the dust check carries headroom.
    const ours = quoteBuy(boundary.poolBeforeLamports, boundary.smallestAcceptedSpend).tokensOutExact;
    const gap = SUPPLY_QUANTUM - ours;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(16);
  });
});
