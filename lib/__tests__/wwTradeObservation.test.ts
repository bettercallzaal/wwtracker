/**
 * The live watcher's verdict, exercised before a real trade has to exercise it.
 *
 * On the evening of the finals the watcher's tally read `0 exact, 0 mismatched,
 * 0 uncountable` - the comparison had never run. It was going to run for the
 * first time on somebody's real trade, during a show, with no way to tell a
 * wrong verdict from a right one. These cases are built from numbers measured
 * off the chain earlier the same day, so the branch that fires live has already
 * fired here.
 */
import { describe, expect, it } from "vitest";
import curve from "../__fixtures__/ww-curve-measured.json";
import { observe, spendForPoolDelta } from "../ww/tradeObservation";
import { SUPPLY_QUANTUM } from "../ww/quote";

type FirstBuy = { spendLamports: number; poolAfter: number; mintedSupply: number };
type Incremental = { firstSpend: number; secondSpend: number; poolBefore: number; supplyBefore: number; tokensMinted: number; poolAfter: number };
type Sell = { poolBefore: number; supplyBefore: number; tokensSold: number; grossLamports: number; supplyAfter: number };
const f = curve as unknown as { firstBuys: FirstBuy[]; incremental: Incremental[]; sells: Sell[] };

it("has measured rows to build the cases from", () => {
  expect(f.firstBuys.length).toBeGreaterThanOrEqual(9);
  expect(f.incremental.length).toBeGreaterThanOrEqual(8);
  expect(f.sells.length).toBeGreaterThanOrEqual(5);
});

describe("a buy the program actually made", () => {
  it("is called EXACT for every measured first buy", () => {
    for (const r of f.firstBuys) {
      const o = observe({ poolLamports: 0, supply: 0 }, { poolLamports: r.poolAfter, supply: r.mintedSupply });
      expect(o.kind, String(r.spendLamports)).toBe("buy");
      expect(o.exact, `${r.spendLamports} lamports`).toBe(true);
    }
  });

  it("is called EXACT for every measured buy onto an existing pool", () => {
    // The case that killed the wrong curve model. If the watcher ever regresses
    // to flooring the total, these fail here rather than live.
    for (const r of f.incremental) {
      const o = observe(
        { poolLamports: r.poolBefore, supply: r.supplyBefore },
        { poolLamports: r.poolAfter, supply: r.supplyBefore + r.tokensMinted },
      );
      expect(o.exact, `${r.secondSpend} onto ${r.poolBefore}`).toBe(true);
    }
  });

  it("recovers the spend from the pool movement", () => {
    for (const r of f.firstBuys) {
      // Within a lamport: the pool takes 98.5% and the division comes back.
      expect(Math.abs(spendForPoolDelta(r.poolAfter) - r.spendLamports)).toBeLessThanOrEqual(1);
    }
  });
});

describe("a sell the program actually made", () => {
  it("is called EXACT for every measured sell", () => {
    for (const r of f.sells) {
      const o = observe(
        { poolLamports: r.poolBefore, supply: r.supplyBefore },
        { poolLamports: r.poolBefore - r.grossLamports, supply: r.supplyAfter },
      );
      expect(o.kind).toBe("sell");
      expect(o.exact, `${r.tokensSold} tokens`).toBe(true);
    }
  });
});

describe("what it refuses to score", () => {
  it("reports no change as nothing", () => {
    const s = { poolLamports: 9_850_000, supply: 70_100_000 };
    expect(observe(s, s).kind).toBe("none");
  });

  it("refuses a mixed direction rather than guessing", () => {
    // Pool up, supply down: two trades cancelling inside one interval.
    const o = observe({ poolLamports: 9_850_000, supply: 70_100_000 }, { poolLamports: 10_000_000, supply: 70_000_000 });
    expect(o.kind).toBe("uncountable");
    expect(o.exact).toBeNull();
    expect(o.note).toMatch(/mixed direction/);
  });

  it("does not score a one-step discrepancy as a failure", () => {
    // Two buys in one interval cannot sum, because each floors its own delta.
    const r = f.incremental[0];
    const o = observe(
      { poolLamports: r.poolBefore, supply: r.supplyBefore },
      { poolLamports: r.poolAfter, supply: r.supplyBefore + r.tokensMinted - SUPPLY_QUANTUM },
    );
    expect(o.kind).toBe("uncountable");
    expect(o.exact).toBeNull();
    expect(o.note).toMatch(/one step/);
  });
});

describe("it can actually fail, which is the point", () => {
  /**
   * A check that cannot report a problem is not a check. Every assertion above
   * says EXACT; this one proves the other branch is reachable.
   */
  it("calls a buy WRONG when the supply is off by a non-step amount", () => {
    const r = f.incremental[0];
    const o = observe(
      { poolLamports: r.poolBefore, supply: r.supplyBefore },
      { poolLamports: r.poolAfter, supply: r.supplyBefore + r.tokensMinted + 37 },
    );
    expect(o.kind).toBe("buy");
    expect(o.exact).toBe(false);
    expect(o.note).toMatch(/MISMATCH/);
  });

  it("calls a sell WRONG when the lamports released do not match the curve", () => {
    const r = f.sells[0];
    const o = observe(
      { poolLamports: r.poolBefore, supply: r.supplyBefore },
      { poolLamports: r.poolBefore - r.grossLamports - 50_000, supply: r.supplyAfter },
    );
    expect(o.exact).toBe(false);
    expect(o.note).toMatch(/MISMATCH/);
  });
});
