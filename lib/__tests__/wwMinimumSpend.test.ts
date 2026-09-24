/**
 * The cheapest buy that mints anything, and why the pool form gets it wrong on
 * a side that has traded.
 *
 * Tokens mint in whole 100,000 steps. Below a threshold that rises with the
 * curve a buy mints zero - the program refuses it and does not take the money,
 * but a screen quoting the wrong threshold sends somebody to that refusal.
 */
import { describe, expect, it } from "vitest";
import {
  minimumSpendAtSupply,
  minimumSpendLamports,
  poolAtSupply,
  quoteBuyAtSupply,
  supplyAtPool,
  SUPPLY_QUANTUM,
} from "../ww/quote";

/** Battle 1789948124, side A: 43 steps of drift between the pool and the supply. */
const DRIFTED_POOL = 37_886_360;
const DRIFTED_SUPPLY = 133_300_000;

describe("the supply form names the real threshold", () => {
  /**
   * The figure is rounded UP into the boundary window, so it mints - and a
   * spend a lamport below it may also mint, because the true boundary sits
   * just under. What must never happen is the returned figure minting nothing,
   * which is what the number is for.
   */
  it.each([
    ["a drifted side", DRIFTED_SUPPLY],
    ["a fresh side", 156_900_000],
    ["an empty pool", 0],
  ])("mints a whole step on %s", (_name, supply) => {
    expect(quoteBuyAtSupply(supply, minimumSpendAtSupply(supply)).tokensOut).toBe(SUPPLY_QUANTUM);
  });

  it.each([
    ["a drifted side", DRIFTED_SUPPLY],
    ["a fresh side", 156_900_000],
  ])("is close above the true boundary on %s, not far above it", (_name, supply) => {
    const min = minimumSpendAtSupply(supply);
    // Well below the threshold mints nothing, so this is a real boundary and
    // not a number that happens to work for any spend.
    expect(quoteBuyAtSupply(supply, Math.floor(min * 0.9)).tokensOut).toBe(0);
    // And the rounding up is small: within a percent of the bare threshold.
    const bare = Math.ceil(
      (poolAtSupply(supply + SUPPLY_QUANTUM) - poolAtSupply(supply)) / 0.985,
    );
    expect(min).toBeGreaterThanOrEqual(bare);
    expect(min / bare).toBeLessThan(1.01);
  });

  it("rises with the supply, since each step costs more further along the curve", () => {
    expect(minimumSpendAtSupply(0)).toBeLessThan(minimumSpendAtSupply(133_300_000));
    expect(minimumSpendAtSupply(133_300_000)).toBeLessThan(minimumSpendAtSupply(156_900_000));
  });

  it("refuses a negative supply rather than returning something", () => {
    expect(() => minimumSpendAtSupply(-1)).toThrow(/supply cannot be negative/);
  });
});

describe("why the pool form is wrong on a traded side", () => {
  /**
   * THE POSITIVE CONTROL. If these ever agree, every assertion here passes for
   * the wrong reason.
   */
  it("the vault's pool implies a supply the program does not hold", () => {
    expect(Math.round(supplyAtPool(DRIFTED_POOL))).toBe(137_634_225);
    expect(DRIFTED_SUPPLY).toBe(133_300_000);
    // 43 steps of drift, and the pool carries 2.35M lamports no token represents.
    expect(Math.round(DRIFTED_POOL - poolAtSupply(DRIFTED_SUPPLY))).toBe(2_348_580);
  });

  it("over-quotes the minimum, telling a trader a trade is impossible when it is not", () => {
    const fromPool = minimumSpendLamports(DRIFTED_POOL);
    const fromSupply = minimumSpendAtSupply(DRIFTED_SUPPLY);
    expect(fromPool).toBeGreaterThan(fromSupply);
    // Around 3% too high on this side.
    expect(fromPool / fromSupply).toBeGreaterThan(1.02);
    // And the over-quoted figure is far above the real boundary: a spend well
    // under it still mints.
    expect(quoteBuyAtSupply(DRIFTED_SUPPLY, Math.floor(fromPool * 0.97)).tokensOut).toBe(
      SUPPLY_QUANTUM,
    );
  });

  /**
   * On an empty side the pool and the supply cannot have drifted, so the two
   * forms are computing the same threshold - and land a couple of lamports
   * apart only because the pool form rounds DOWN into the boundary window and
   * this one rounds UP. That is the whole difference where there is no
   * residual, which is what makes the 3% gap on a drifted side attributable to
   * the drift rather than to the rounding.
   */
  it("differs only by the rounding where there is no residual", () => {
    const pool = minimumSpendLamports(0);
    const supply = minimumSpendAtSupply(0);
    expect(supply).toBeGreaterThanOrEqual(pool);
    expect(supply - pool).toBeLessThanOrEqual(4);
  });
});
