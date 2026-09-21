import { describe, expect, it } from "vitest";
import { quoteClaim } from "../ww/quote";

/**
 * Fifteen real claims across the three 2026-09-20 finals battles, each
 * asserted EXACT against the lamports the ClaimShares program log says it
 * transferred.
 *
 * Until 2026-09-21 this file asserted "within 20,000 lamports" and called the
 * gap an unexplained residual. Two things were wrong at once. The formula:
 * the program truncates the share to parts per million before multiplying
 * (its log prints "Proportion (scaled by 1M)"). The inputs: the round 2 pools
 * here were 1.9172 and 0.0796 SOL, four-decimal figures from the API, and the
 * account holds 1,917,213,260 and 79,632,100 lamports. With the program's
 * arithmetic and the account's numbers, every claim lands on the lamport.
 *
 * Pools and supplies below are read from the battle accounts (bytes 212, 220,
 * 196, 204); payouts from the program logs; distribution totals from the
 * EndBattle logs and byte 249.
 */
const R1 = { id: 1789948124, poolA: 37_886_360, poolB: 1_488_815_340, supplyA: 133_300_000, supplyB: 862_300_000 };
const R2 = { id: 1789949789, poolA: 79_632_100, poolB: 1_917_213_260, supplyA: 195_900_000, supplyB: 978_400_000 };
const R3 = { id: 1789951764, poolA: 455_246_600, poolB: 9_121_260_940, supplyA: 476_400_000, supplyB: 2_135_200_000 };
// B won all three by pool.
const win = (r: typeof R1) => ({ sidePool: r.poolB, otherPool: r.poolA, sideSupply: r.supplyB, won: true as const });
const lose = (r: typeof R1) => ({ sidePool: r.poolA, otherPool: r.poolB, sideSupply: r.supplyA, won: false as const });

const winners: Array<[string, typeof R1, number, number]> = [
  ["R1", R1, 117_800_000, 205_458_829],
  ["R2 Zaal", R2, 665_700_000, 1_326_136_778],
  ["R2", R2, 90_800_000, 180_881_130],
  ["R2", R2, 27_900_000, 55_577_619],
  ["R2", R2, 34_200_000, 68_129_605],
  ["R2", R2, 2_600_000, 5_178_668],
  ["R2", R2, 61_000_000, 121_516_475],
  ["R3 Zaal", R3, 40_500_000, 176_456_821],
  ["R3 whale", R3, 1_892_300_000, 8_245_009_394],
  ["R3", R3, 14_400_000, 62_741_857],
  ["R3", R3, 82_500_000, 359_463_207],
  ["R3", R3, 43_600_000, 189_965_299],
  ["R3", R3, 47_300_000, 206_088_021],
];
const losers: Array<[string, typeof R1, number, number]> = [
  ["R1", R1, 64_100_000, 9_109_206],
  ["R1", R1, 49_900_000, 7_091_246],
  ["R3", R3, 3_000_000, 1_433_343],
];

describe("quoteClaim against the program's own logged claims", () => {
  it("reproduces the distribution totals EndBattle logged and byte 249 holds", () => {
    expect(quoteClaim({ ...win(R1), balance: 1 }).distributionLamports).toBe(1_503_969_884);
    expect(quoteClaim({ ...lose(R1), balance: 1 }).distributionLamports).toBe(18_943_180);
    expect(quoteClaim({ ...win(R2), balance: 1 }).distributionLamports).toBe(1_949_066_100);
    expect(quoteClaim({ ...win(R3), balance: 1 }).distributionLamports).toBe(9_303_359_580);
    expect(quoteClaim({ ...lose(R3), balance: 1 }).distributionLamports).toBe(227_623_300);
  });

  it.each(winners.map(([l, r, bal, prog]) => [`${l} balance ${bal}`, r, bal, prog] as const))(
    "%s: exact",
    (_label, r, balance, program) => {
      const q = quoteClaim({ ...win(r), balance });
      expect(q.outcome).toBe("won");
      expect(q.lamportsOut).toBe(program);
    },
  );

  it.each(losers.map(([l, r, bal, prog]) => [`${l} balance ${bal}`, r, bal, prog] as const))(
    "loser %s: exact, half the losing pool pro rata",
    (_label, r, balance, program) => {
      const q = quoteClaim({ ...lose(r), balance });
      expect(q.outcome).toBe("lost");
      expect(q.lamportsOut).toBe(program);
    },
  );

  it("exposes the program's proportion in parts per million", () => {
    // From the R1 loser log: "Proportion (scaled by 1M): 480870".
    expect(quoteClaim({ ...lose(R1), balance: 64_100_000 }).proportionPpm).toBe(480_870);
  });

  /**
   * The control for the old formula. A float share times the distribution,
   * floored, misses this claim by 17,759 lamports; the program's truncation
   * to ppm is the whole difference.
   */
  it("is not the float formula", () => {
    const float = Math.floor((665_700_000 / R2.supplyB) * 1_949_066_100);
    expect(float).not.toBe(1_326_136_778);
    expect(quoteClaim({ ...win(R2), balance: 665_700_000 }).lamportsOut).toBe(1_326_136_778);
  });

  it("refuses a balance above the side's supply", () => {
    expect(() => quoteClaim({ ...win(R3), balance: R3.supplyB + 1 })).toThrow(/exceeds/);
  });

  it("refuses fractional inputs, because the program works in whole units", () => {
    expect(() => quoteClaim({ ...win(R3), sidePool: 9_121_260_940.5, balance: 1 })).toThrow(/whole/);
  });
});
