/**
 * The four curve models must be four DIFFERENT pieces of arithmetic.
 *
 * `scripts/ww-verify-battle.ts` scores four candidate buy models against every
 * real trade in a battle and prints them side by side. That scoreboard is how
 * #411 was decided, and it only means anything while each column is its own
 * expression.
 *
 * ON 2026-09-24 IT QUIETLY BECAME THREE. The floor-the-total column called
 * `quoteBuyAtSupply`, which WAS the floor-the-total model when that line was
 * written and BECAME the from-stored-supply model in #411. For two days the
 * scoreboard printed the winner twice under two names:
 *
 *   before #411   floor-the-total   5 / 3 / 2      on the three finals
 *   after  #411   floor-the-total  33 / 37 / 32    the other column's echo
 *
 * Two independent models agreeing is the most persuasive thing a scoreboard can
 * say, and this was one model talking to itself. Nothing failed. No test broke.
 * The label went on meaning what it used to mean.
 *
 * So the models are pinned here by their arithmetic, against real trades, with
 * a case that forces them apart. A column that starts echoing another fails
 * this file rather than reading as corroboration.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-real-buys-2026-09-24.json";
import liveMoves from "../__fixtures__/ww-live-pool-moves-2026-09-24.json";
import { supplyAtPool, poolAtSupply, BUY_POOL_SHARE, SUPPLY_QUANTUM, quoteBuy, quoteBuyAtSupply } from "../ww/quote";

type Trade = { poolLamports: number; supplyBefore: number; spendLamports: number; programTokens: number };
const trades = (fixture as unknown as { trades: Trade[] }).trades;

/**
 * THE DISTINCTNESS CASES NEED A RESIDUAL, and `ww-real-buys` mostly has none.
 *
 * Eight of its 22 rows do carry one, and the models still agree on all 22:
 * a residual only separates them when it pushes the floor across a
 * 100,000-token boundary, and a small one does not. A test built on that
 * fixture alone passes for the wrong reason.
 *
 * Every pool-up move the live watcher has stored is the right basis - 110 of its
 * 135 carry a residual, over 14 battles including sides that have sold, which is
 * where the four forms actually part company.
 */
type Move = { before: { poolLamports: number; supply: number }; after: { poolLamports: number; supply: number } };
const moves = (liveMoves as unknown as { moves: Move[] }).moves;
const asTrade = (m: Move): Trade => ({
  poolLamports: m.before.poolLamports,
  supplyBefore: m.before.supply,
  // The watcher stores pools, not spends. A buy puts BUY_POOL_SHARE of the
  // spend into the pool, so the spend is the pool move divided by that share.
  spendLamports: (m.after.poolLamports - m.before.poolLamports) / BUY_POOL_SHARE,
  programTokens: m.after.supply - m.before.supply,
});
const residualMoves = moves.map(asTrade).filter((t) => Math.abs(t.poolLamports - poolAtSupply(t.supplyBefore)) > 1);
const floorQ = (x: number) => Math.floor(x / SUPPLY_QUANTUM) * SUPPLY_QUANTUM;

/** The four candidates, written out rather than borrowed from a library. */
const MODELS = {
  "floor-the-difference": (pool: number, supply: number, spend: number) =>
    floorQ(supplyAtPool(pool + spend * BUY_POOL_SHARE) - supplyAtPool(pool)),
  "floor-the-total": (pool: number, supply: number, spend: number) =>
    floorQ(supplyAtPool(pool + spend * BUY_POOL_SHARE)) - supply,
  "floor-both-endpoints": (pool: number, supply: number, spend: number) =>
    floorQ(supplyAtPool(pool + spend * BUY_POOL_SHARE)) - floorQ(supplyAtPool(pool)),
  "from-stored-supply": (pool: number, supply: number, spend: number) =>
    floorQ(supplyAtPool(poolAtSupply(supply) + spend * BUY_POOL_SHARE)) - supply,
};

it("has real trades to score against, including sides carrying a residual", () => {
  expect(trades.length).toBeGreaterThanOrEqual(20);
  expect(trades.some((t) => t.supplyBefore > 0)).toBe(true);
  // The positive control for the fixture itself: without residual rows the
  // distinctness cases below would pass on a technicality.
  expect(residualMoves.length).toBeGreaterThan(50);
});

describe("no two models are the same function", () => {
  const names = Object.keys(MODELS) as Array<keyof typeof MODELS>;
  const pairs = names.flatMap((a, i) => names.slice(i + 1).map((b) => [a, b] as const));

  it.each(pairs)("%s and %s disagree on at least one real trade", (a, b) => {
    const differ = residualMoves.filter((t) => {
      const x = MODELS[a](t.poolLamports, t.supplyBefore, t.spendLamports);
      const y = MODELS[b](t.poolLamports, t.supplyBefore, t.spendLamports);
      return x !== y;
    });
    // If this fails, two columns of the scoreboard are the same arithmetic and
    // their agreement proves nothing. That is the 2026-09-24 defect exactly.
    expect(differ.length, `${a} and ${b} agree on all ${residualMoves.length} residual-carrying trades`).toBeGreaterThan(0);
  });
});

describe("the two shipped functions still mean what the scoreboard calls them", () => {
  it("quoteBuy IS floor-the-difference on every real trade", () => {
    for (const t of trades) {
      expect(quoteBuy(t.poolLamports, t.spendLamports).tokensOut)
        .toBe(MODELS["floor-the-difference"](t.poolLamports, t.supplyBefore, t.spendLamports));
    }
  });

  it("quoteBuyAtSupply IS from-stored-supply, and is NOT floor-the-total", () => {
    // The second half is the guard. quoteBuyAtSupply was floor-the-total once;
    // if it ever is again, the scoreboard's fourth column silently becomes its
    // second and this says so.
    let sawADifference = false;
    for (const t of trades) {
      const ours = quoteBuyAtSupply(t.supplyBefore, t.spendLamports).tokensOut;
      expect(ours).toBe(MODELS["from-stored-supply"](t.poolLamports, t.supplyBefore, t.spendLamports));
    }
    for (const t of residualMoves) {
      if (quoteBuyAtSupply(t.supplyBefore, t.spendLamports).tokensOut
        !== MODELS["floor-the-total"](t.poolLamports, t.supplyBefore, t.spendLamports)) sawADifference = true;
    }
    expect(sawADifference, "quoteBuyAtSupply matched floor-the-total on every trade").toBe(true);
  });

  it("and from-stored-supply is the one that matches the program", () => {
    const exact = trades.filter((t) =>
      MODELS["from-stored-supply"](t.poolLamports, t.supplyBefore, t.spendLamports) === t.programTokens);
    expect(exact.length).toBe(trades.length);
  });
});
