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
  describeMarginBands,
  marginBands,
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

/**
 * IS A DISAGREEMENT JUST A CLOSE CALL? The comfortable answer is that these
 * were split decisions - judges nearly tied, so which way it fell was close to
 * a coin and the money landed the other way. If that were it, the rate would
 * fall as the judged margin widens. Measured over 1,445 comparable battles, it
 * does not: no band differs from the overall 10.2% by more than chance.
 */
describe("disagreements are not close calls", () => {
  const row = (margin: number | null, outcome: "agree" | "disagree") => ({ margin, outcome });

  it("buckets by the judged margin, ten points at a time", () => {
    const bands = marginBands([row(0, "disagree"), row(9, "agree"), row(10, "agree")]);
    expect(bands.map((b) => b.from)).toEqual([0, 10]);
    expect(bands[0]).toMatchObject({ disagree: 1, comparable: 2 });
  });

  /**
   * A MISSING MARGIN IS NOT A DEAD HEAT. Bucketing it at zero would put every
   * unknown in the closest band, which is the one place it would change the
   * reading.
   */
  it("skips a battle with no margin rather than calling it zero", () => {
    const bands = marginBands([row(null, "disagree"), row(null, "agree")]);
    expect(bands).toEqual([]);
  });

  it("puts a perfect 100 in the top band rather than opening one for it", () => {
    const bands = marginBands([row(100, "agree"), row(95, "agree")]);
    expect(bands.map((b) => b.from)).toEqual([90]);
    expect(bands[0].comparable).toBe(2);
  });

  it("leaves ties and unsettled battles out, as everywhere else", () => {
    const bands = marginBands([
      { margin: 50, outcome: "tie" },
      { margin: 50, outcome: "unsettled" },
      { margin: 50, outcome: "unresolvable" },
    ]);
    expect(bands).toEqual([]);
  });

  it("prints a tail beside every band, so a flat result cannot read as a trend", () => {
    const lines = describeMarginBands(
      marginBands([
        ...Array.from({ length: 179 }, (_, i) => row(5, i < 22 ? "disagree" : "agree")),
        ...Array.from({ length: 274 }, (_, i) => row(95, i < 25 ? "disagree" : "agree")),
      ]),
    ).join("\n");
    // The real numbers: 12.3% at the closest, 9.1% at the most decisive.
    expect(lines).toMatch(/margin {2}0-9% {3}22 of {2}179 {2}12\.3%/);
    expect(lines).toMatch(/margin 90-99% {3}25 of {2}274 {2}9\.1%/);
    expect(lines).toMatch(/chance gives this or more/);
  });

  it("says so plainly when nothing carries a margin", () => {
    expect(describeMarginBands([]).join("\n")).toMatch(/NO COMPARABLE BATTLES CARRY A MARGIN/);
  });
});
