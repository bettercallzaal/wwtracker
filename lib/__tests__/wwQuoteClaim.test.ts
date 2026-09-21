import { describe, expect, it } from "vitest";
import { quoteClaim } from "../ww/quote";

/**
 * Twelve real claims, read from ClaimShares program logs on 2026-09-20.
 * The distribution totals are the EndBattle log's own numbers, so those two
 * are asserted exact; the per-claim payouts carry a 4e-5 residual the program
 * produces and this model does not explain, so those are asserted within
 * 20,000 lamports absolute and 2e-4 relative (the residual is absolute, so
 * the smallest claims carry the largest relative miss).
 */
const R3 = { sidePool: 9_121_260_940, otherPool: 455_246_600, sideSupply: 2_135_200_000 };
const R2 = { sidePool: 1_917_200_000, otherPool: 79_600_000, sideSupply: 978_400_000 };

const winners: Array<[string, typeof R3, number, number]> = [
  ["R3 Zaal", R3, 40_500_000, 176_456_821],
  ["R3 whale", R3, 1_892_300_000, 8_245_009_394],
  ["R3", R3, 14_400_000, 62_741_857],
  ["R3", R3, 82_500_000, 359_463_207],
  ["R3", R3, 43_600_000, 189_965_299],
  ["R3", R3, 47_300_000, 206_088_021],
  ["R2 Zaal", R2, 665_700_000, 1_326_136_778],
  ["R2", R2, 90_800_000, 180_881_130],
  ["R2", R2, 27_900_000, 55_577_619],
  ["R2", R2, 34_200_000, 68_129_605],
  ["R2", R2, 2_600_000, 5_178_668],
  ["R2", R2, 61_000_000, 121_516_475],
];

describe("quoteClaim against the program's own logged claims", () => {
  it("reproduces EndBattle's distribution totals exactly", () => {
    expect(quoteClaim({ ...R3, balance: 1, won: true }).distributionLamports).toBe(9_303_359_580);
    expect(quoteClaim({ ...R3, balance: 1, won: false, sidePool: R3.otherPool, sideSupply: 476_400_000, otherPool: R3.sidePool }).distributionLamports).toBe(227_623_300);
    expect(quoteClaim({ ...R2, balance: 1, won: true }).distributionLamports).toBe(1_949_040_000);
  });

  it.each(winners.map(([l, b, bal, prog]) => [`${l} balance ${bal}`, b, bal, prog] as const))(
    "%s: within 20,000 lamports and 2e-4 of the program",
    (_label, b, balance, program) => {
      const q = quoteClaim({ ...b, balance, won: true });
      expect(q.outcome).toBe("won");
      // The residual is absolute, so both bounds are stated: a small claim can
      // pass the lamport bound and fail a tight relative one.
      expect(Math.abs(q.lamportsOut - program)).toBeLessThan(20_000);
      expect(Math.abs(q.lamportsOut - program) / program).toBeLessThan(2e-4);
    },
  );

  it("a loser claims half the losing pool pro rata", () => {
    // GzJ2jqdf on R3: 3,000,000 tokens of a 476,400,000 losing supply, program paid 1,433,343.
    const q = quoteClaim({ balance: 3_000_000, sideSupply: 476_400_000, sidePool: 455_246_600, otherPool: 9_121_260_940, won: false });
    expect(q.outcome).toBe("lost");
    expect(Math.abs(q.lamportsOut - 1_433_343)).toBeLessThan(20_000);
  });

  it("refuses a balance above the side's supply", () => {
    expect(() => quoteClaim({ ...R3, balance: R3.sideSupply + 1, won: true })).toThrow(/exceeds/);
  });
});
