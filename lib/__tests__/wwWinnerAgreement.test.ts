/**
 * A battle has two winners: the larger pool, which the program pays on, and
 * the judged result, which the room is told. They disagree on about one in ten
 * overall, and that is the system working.
 *
 * What nobody had asked is whether the rate is the same per format - a
 * question about the judging procedure, since quick battles use 2-of-3 and
 * main events a panel.
 */
import { describe, expect, it } from "vitest";
import {
  agreementByFormat,
  chanceOfAtLeast,
  compare,
  disagreementRate,
  judgedSide,
  type JudgedBattle,
  type SettledBattle,
} from "../ww/winnerAgreement";

const judged = (over: Partial<JudgedBattle> = {}): JudgedBattle => ({
  battleId: 1,
  type: "quick",
  judgedWinner: "Geek Myth",
  sideA: "Geek Myth",
  sideB: "Stormi",
  ...over,
});
const settled = (over: Partial<SettledBattle> = {}): SettledBattle => ({
  battleId: 1,
  settlementWinner: "artist_a",
  poolLamports: { a: 900, b: 100 },
  ...over,
});

describe("which side the judged winner names", () => {
  it("matches either side by name, ignoring case and padding", () => {
    expect(judgedSide(judged({ judgedWinner: "  geek myth " }))).toBe("a");
    expect(judgedSide(judged({ judgedWinner: "STORMI" }))).toBe("b");
  });

  it("is null when the name matches neither, rather than guessing", () => {
    expect(judgedSide(judged({ judgedWinner: "Somebody Else" }))).toBeNull();
  });

  /**
   * BOTH IS NOT A CURIOSITY. A battle can run the same artist on each side,
   * and a naive match would silently pick A - moving the headline rate.
   */
  it("is null when both sides are the same artist", () => {
    expect(judgedSide(judged({ sideA: "Geek Myth", sideB: "Geek Myth" }))).toBeNull();
  });
});

describe("comparing the two winners", () => {
  it("agrees when the judged side is the larger pool", () => {
    expect(compare(judged(), settled())).toBe("agree");
  });

  it("disagrees when it is not", () => {
    expect(compare(judged({ judgedWinner: "Stormi" }), settled())).toBe("disagree");
  });

  /**
   * A TIE IS NOT A DISAGREEMENT. The program records artist B on an exactly
   * level pool and pays both sides pro rata, so there is no winning side for a
   * judge to have differed from. Counting ties as disagreements would have
   * added 62 false ones.
   */
  it("keeps an exactly level pool out of both columns", () => {
    const tied = settled({ poolLamports: { a: 500, b: 500 }, settlementWinner: "artist_b" });
    expect(compare(judged(), tied)).toBe("tie");
    expect(compare(judged({ judgedWinner: "Stormi" }), tied)).toBe("tie");
  });

  it("keeps an unsettled battle out, since the program has not called it", () => {
    expect(compare(judged(), settled({ settlementWinner: null }))).toBe("unsettled");
  });

  it("keeps an unmatchable name out rather than counting it either way", () => {
    expect(compare(judged({ judgedWinner: "Nobody" }), settled())).toBe("unresolvable");
  });
});

describe("per format", () => {
  it("counts only agree and disagree toward the comparable denominator", () => {
    const rows: JudgedBattle[] = [
      judged({ battleId: 1 }),
      judged({ battleId: 2, judgedWinner: "Stormi" }),
      judged({ battleId: 3 }),
      judged({ battleId: 4, judgedWinner: "Nobody" }),
    ];
    const byId = new Map<number, SettledBattle>([
      [1, settled({ battleId: 1 })],
      [2, settled({ battleId: 2 })],
      [3, settled({ battleId: 3, poolLamports: { a: 5, b: 5 } })],
      [4, settled({ battleId: 4 })],
    ]);
    const [q] = agreementByFormat(rows, byId);
    expect(q).toMatchObject({ agree: 1, disagree: 1, tie: 1, unresolvable: 1, comparable: 2 });
    expect(disagreementRate(q)).toBe(0.5);
  });

  it("has an UNKNOWN rate, not zero, when nothing was comparable", () => {
    const byId = new Map<number, SettledBattle>([[1, settled({ settlementWinner: null })]]);
    const [f] = agreementByFormat([judged()], byId);
    expect(f.comparable).toBe(0);
    expect(disagreementRate(f)).toBeNull();
  });

  it("skips a judged battle with no chain account rather than counting it", () => {
    expect(agreementByFormat([judged({ battleId: 99 })], new Map())).toEqual([]);
  });
});

describe("the tail, which is what separates the two high rates", () => {
  /**
   * Measured 2026-09-24: main events 28 of 178 (15.7%) and community 4 of 25
   * (16.0%), against quick battles' 117 of 1,245 (9.4%). The two look alike
   * and are not.
   */
  const QUICK = 117 / 1245;

  it("calls the main-event excess unlikely at the quick rate", () => {
    const p = chanceOfAtLeast(28, 178, QUICK);
    expect(p).not.toBeNull();
    expect(p!).toBeLessThan(0.01);
  });

  it("calls the community rate entirely ordinary, despite looking the same", () => {
    const p = chanceOfAtLeast(4, 25, QUICK);
    expect(p!).toBeGreaterThan(0.1);
  });

  it("is a whole probability at zero disagreements and tiny at all of them", () => {
    expect(chanceOfAtLeast(0, 10, 0.5)).toBeCloseTo(1, 10);
    expect(chanceOfAtLeast(10, 10, 0.5)).toBeCloseTo(Math.pow(0.5, 10), 12);
  });

  it("is null rather than a number when there is nothing to compute", () => {
    expect(chanceOfAtLeast(1, 0, 0.1)).toBeNull();
    expect(chanceOfAtLeast(5, 3, 0.1)).toBeNull();
    expect(chanceOfAtLeast(1, 10, 0)).toBeNull();
    expect(chanceOfAtLeast(1, 10, 1)).toBeNull();
  });
});
