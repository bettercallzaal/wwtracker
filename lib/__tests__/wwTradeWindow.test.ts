/**
 * The 60-second gate, and the correction it forced.
 *
 * Measured 2026-09-24 by simulating a launch and a buy in one transaction
 * against the CHAIN clock: 51s, 55s, 58s and 59s after start_time were all
 * refused with BattleNotActive (6003); 61s was accepted.
 */
import { describe, expect, it } from "vitest";
import {
  bindingConstraint,
  tradeableFrom,
  BUY_OPENS_AFTER_START_SECONDS,
} from "../ww/tradeWindow";

describe("the gate", () => {
  it("is 60 seconds", () => {
    expect(BUY_OPENS_AFTER_START_SECONDS).toBe(60);
  });
});

describe("when a battle can actually be traded", () => {
  it("is the gate when the mints landed before it, which is the usual case", () => {
    // Real shape: mints ready 10s after start, gate opens at 60s.
    expect(tradeableFrom(1_000, 1_010)).toBe(1_060);
    expect(bindingConstraint(1_000, 1_010)).toBe("gate");
  });

  it("is the mints when they landed after the gate", () => {
    expect(tradeableFrom(1_000, 1_200)).toBe(1_200);
    expect(bindingConstraint(1_000, 1_200)).toBe("mints");
  });

  it("treats the exact tie as the gate, since at that instant both are satisfied", () => {
    expect(tradeableFrom(1_000, 1_060)).toBe(1_060);
    expect(bindingConstraint(1_000, 1_060)).toBe("gate");
  });

  /**
   * UNKNOWN PROPAGATES. Falling back to the gate alone would answer a battle
   * whose mints landed late with a time that is too EARLY - and too early is
   * the direction that invents trading opportunities nobody had.
   */
  it("is null when the mints are unknown, not the gate alone", () => {
    expect(tradeableFrom(1_000, null)).toBeNull();
    expect(bindingConstraint(1_000, null)).toBe("unknown");
  });
});

describe("the three real battles, corrected", () => {
  /**
   * Measured first trades: 66s, 66s and 67s after start_time, with mints ready
   * at +32, +10 and +10. Read against the mints those gaps are 34, 56 and 57
   * seconds, a spread that invited a story about who was watching what. Read
   * against the moment a buy could actually land, they are 6, 6 and 7.
   */
  it("puts every first trade within seconds of the gate opening", () => {
    const cases: Array<[number, number, number]> = [
      [1_789_948_124, 32, 66],
      [1_789_442_838, 10, 66],
      [1_789_177_998, 10, 67],
    ];
    const gaps = cases.map(([start, mintsAfter, tradeAfter]) => {
      const from = tradeableFrom(start, start + mintsAfter);
      return from === null ? null : start + tradeAfter - from;
    });
    expect(gaps).toEqual([6, 6, 7]);
    // And the gate, not the mints, is what bound all three.
    for (const [start, mintsAfter] of cases) {
      expect(bindingConstraint(start, start + mintsAfter)).toBe("gate");
    }
  });
});
