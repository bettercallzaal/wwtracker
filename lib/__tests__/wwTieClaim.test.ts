/**
 * WHAT A TIE ACTUALLY PAYS, pinned to two battles that really settled.
 *
 * Found 2026-09-22 by scanning every battle account: 28 of 1,500 battles with
 * money on both sides ended at EXACTLY equal pools, 26 of them are settled,
 * and all 26 recorded artist B as the winner byte. But the winner byte is not
 * what the claim path uses - the program has a separate "Tie case" branch, and
 * `quoteClaim`'s win/lose split never applied to any of those 26 battles.
 *
 * This repo quoted them with the wrong formula until this file existed.
 */
import { describe, expect, it } from "vitest";
import { quoteClaim, quoteTieClaim } from "../ww/quote";

/**
 * Battle 1774061797, 2026-03-21. Two traders, both holding on both sides,
 * pools 78,800,000 each, supplies 198,300,000 and 198,400,000.
 * Program logs: proportion 790773 -> 124,625,824 and 209226 -> 32,974,017.
 */
const EARLY = { balanceA: 156_800_000, balanceB: 156_900_000 };
const LATE = { balanceA: 41_500_000, balanceB: 41_500_000 };
const BATTLE = { supplyA: 198_300_000, supplyB: 198_400_000, poolALamports: 78_800_000, poolBLamports: 78_800_000 };

describe("quoteTieClaim reproduces the program, to the lamport", () => {
  it("pays the early trader exactly what the chain paid", () => {
    const q = quoteTieClaim({ ...EARLY, ...BATTLE });
    expect(q.proportionPpm).toBe(790_773);
    expect(q.lamportsOut).toBe(124_625_824);
  });

  it("pays the later trader exactly what the chain paid", () => {
    const q = quoteTieClaim({ ...LATE, ...BATTLE });
    expect(q.proportionPpm).toBe(209_226);
    expect(q.lamportsOut).toBe(32_974_017);
  });

  it("empties both pools between them, minus what flooring keeps", () => {
    const a = quoteTieClaim({ ...EARLY, ...BATTLE }).lamportsOut;
    const b = quoteTieClaim({ ...LATE, ...BATTLE }).lamportsOut;
    expect(a + b).toBe(157_599_841);
    expect(157_600_000 - (a + b)).toBe(159); // stays in the vault, as the fee split does
  });

  /** Battle 1789783495, 2026-09-19: one holder, both sides, the whole pot. */
  it("pays a sole holder the whole of both pools", () => {
    const q = quoteTieClaim({
      balanceA: 156_900_000, balanceB: 156_900_000,
      supplyA: 156_900_000, supplyB: 156_900_000,
      poolALamports: 49_250_000, poolBLamports: 49_250_000,
    });
    expect(q.proportionPpm).toBe(1_000_000);
    expect(q.lamportsOut).toBe(98_500_000);
  });

  it("refuses impossible inputs rather than inventing a number", () => {
    expect(() => quoteTieClaim({ ...BATTLE, balanceA: 1e9, balanceB: 0 })).toThrow(/exceeds total supply/);
    expect(() => quoteTieClaim({ supplyA: 0, supplyB: 0, poolALamports: 1, poolBLamports: 1, balanceA: 0, balanceB: 0 })).toThrow(/nothing to claim/);
  });
});

describe("quoteClaim refuses a tie instead of answering wrongly", () => {
  it("throws, and names the function that is right", () => {
    expect(() =>
      quoteClaim({ balance: 41_500_000, sideSupply: 198_400_000, sidePool: 78_800_000, otherPool: 78_800_000, won: true }),
    ).toThrow(/use quoteTieClaim/);
  });

  /**
   * THE SIZE OF THE ERROR IT USED TO MAKE, kept so nobody reinstates the old
   * path thinking it was close enough. Quoting the later trader's two sides
   * with the win/lose split gives 31,321,518 across TWO claim rows, against
   * the single 32,974,017 the chain actually paid: 1,652,499 lamports light,
   * and the wrong shape as well as the wrong number.
   */
  it("would have been 1,652,499 lamports light, in two rows instead of one", () => {
    const winSide = (78_800_000n + (78_800_000n * 40n) / 100n) * ((41_500_000n * 1_000_000n) / 198_400_000n) / 1_000_000n;
    const loseSide = ((78_800_000n * 50n) / 100n) * ((41_500_000n * 1_000_000n) / 198_300_000n) / 1_000_000n;
    expect(Number(winSide) + Number(loseSide)).toBe(31_321_518);
    expect(32_974_017 - 31_321_518).toBe(1_652_499);
  });
});
