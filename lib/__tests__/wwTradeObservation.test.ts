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

/**
 * The replay that caught it.
 *
 * The watcher called `quoteBuy` - the POOL form - while `before.supply` sat in
 * the same object, and its "off by exactly one step" branch then filed every
 * resulting failure as uncountable. One step is precisely how the pool form is
 * wrong, so the model's own error was being swallowed by the branch built to
 * excuse it, and the tally read 0 mismatched because nothing could ever reach
 * the mismatch column.
 *
 * The fixture is every pool-up move this watcher has ever stored, lifted out of
 * `var/ww-live` (gitignored, so it is copied here to be replayable). The counts
 * below are the measurement, and the last case is the positive control: if the
 * two models ever agree everywhere, this file is no longer testing anything and
 * says so rather than passing.
 */
import moves from "../__fixtures__/ww-live-pool-moves-2026-09-24.json";
import { quoteBuy, quoteBuyAtSupply } from "../ww/quote";

type Move = { battleId: string; side: string; before: BattleSideRow; after: BattleSideRow };
type BattleSideRow = { poolLamports: number; supply: number };
const live = (moves as unknown as { moves: Move[] }).moves;

describe("every pool-up move the watcher has stored", () => {
  it("has enough moves and battles to mean anything", () => {
    expect(live.length).toBe(135);
    expect(new Set(live.map((m) => m.battleId)).size).toBe(14);
  });

  it("is reproduced exactly by the supply-based quote, 135 of 135", () => {
    const exact = live.filter((m) => {
      const spend = spendForPoolDelta(m.after.poolLamports - m.before.poolLamports);
      return quoteBuyAtSupply(m.before.supply, spend).tokensOut === m.after.supply - m.before.supply;
    });
    expect(exact.length).toBe(live.length);
  });

  it("was reproduced by the pool-based quote on only 102 of 135", () => {
    // The 33 it misses are the ones the escape hatch was absorbing. If this
    // number climbs to 135, the pool form is no longer distinguishable here and
    // the case above stops proving anything - which is what the control checks.
    const exact = live.filter((m) => {
      const spend = spendForPoolDelta(m.after.poolLamports - m.before.poolLamports);
      return quoteBuy(m.before.poolLamports, spend).tokensOut === m.after.supply - m.before.supply;
    });
    expect(exact.length).toBe(102);
  });

  it("CONTROL: the two models really do disagree on some stored move", () => {
    const disagree = live.filter((m) => {
      const spend = spendForPoolDelta(m.after.poolLamports - m.before.poolLamports);
      return quoteBuy(m.before.poolLamports, spend).tokensOut
        !== quoteBuyAtSupply(m.before.supply, spend).tokensOut;
    });
    expect(disagree.length).toBeGreaterThan(0);
  });

  it("and `observe` calls every one of them an exact buy, none uncountable", () => {
    const kinds = live.map((m) => observe(m.before, m.after));
    expect(kinds.filter((o) => o.kind === "buy" && o.exact === true).length).toBe(live.length);
    expect(kinds.filter((o) => o.kind === "uncountable").length).toBe(0);
  });
});
