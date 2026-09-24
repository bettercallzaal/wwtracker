/**
 * Whether going first lands on the larger pool - and the ways that number
 * lies. The first buy is money in the pool it is being scored against, so the
 * measurement has to carry its own limit or it reads as a skill rate.
 */
import { describe, expect, it } from "vitest";
import {
  coinTailProbability,
  describeFirstSide,
  firstSideReport,
  marginShare,
  outcomeOf,
  type FirstSideRow,
} from "../ww/firstSide";

const row = (
  side: "a" | "b",
  poolALamports: number,
  poolBLamports: number,
  amountLamports = 1_000,
  battleId = 1,
): FirstSideRow => ({ battleId, side, amountLamports, poolALamports, poolBLamports });

describe("outcome", () => {
  it("is a hit when the opening side ended larger, either way round", () => {
    expect(outcomeOf(row("a", 900, 100))).toBe("hit");
    expect(outcomeOf(row("b", 100, 900))).toBe("hit");
  });
  it("is a miss when it did not", () => {
    expect(outcomeOf(row("a", 100, 900))).toBe("miss");
  });
  it("is a tie when the pools finished level, not a win for B", () => {
    // The winner BYTE records B on a tie, measured on 26 of 26 settled ties.
    // Scoring that as a hit for B would invent a result the program does not
    // pay out: a tie pays both sides pro rata.
    expect(outcomeOf(row("b", 500, 500))).toBe("tie");
    expect(outcomeOf(row("a", 500, 500))).toBe("tie");
  });
  it("is empty when no money arrived at all, which is not a tie", () => {
    expect(outcomeOf(row("a", 0, 0))).toBe("empty");
  });
});

describe("marginShare", () => {
  it("is the opening buy over the winning margin", () => {
    expect(marginShare(row("a", 900, 100, 400))).toBeCloseTo(0.5);
  });
  it("is null on a tie rather than a number", () => {
    // A zero margin has no share. Returning 0 or 1 would put every tie at one
    // end of the distribution and skew the decisive split.
    expect(marginShare(row("a", 500, 500, 400))).toBeNull();
  });
});

describe("the report", () => {
  it("excludes ties and empties from the hit rate and says it did", () => {
    const r = firstSideReport([
      row("a", 900, 100),
      row("a", 100, 900),
      row("b", 500, 500),
      row("a", 0, 0),
    ]);
    expect(r).toMatchObject({ rows: 4, hits: 1, misses: 1, ties: 1, empties: 1 });
    const lines = describeFirstSide(r).join("\n");
    expect(lines).toMatch(/1 of 2 decided battles/);
    expect(lines).toMatch(/1 tie\(s\) and 1 empty battle\(s\) excluded/);
  });

  it("splits out the battles the opening buy could not itself account for", () => {
    const r = firstSideReport([
      // margin 800, buy 40: 5% of the margin, decisive
      row("a", 900, 100, 40),
      // margin 800, buy 700: 88% of the margin, not decisive
      row("a", 900, 100, 700),
      // margin 800, buy 10, and a miss
      row("b", 900, 100, 10),
    ]);
    expect(r.decisive).toMatchObject({ rows: 2, hits: 1, misses: 1 });
    expect(describeFirstSide(r).join("\n")).toMatch(/under 25% of the final margin: 1 of 2/);
  });

  it("says plainly when no battle was decisive, rather than printing 0 of 0", () => {
    const r = firstSideReport([row("a", 900, 100, 700)]);
    expect(r.decisive.rows).toBe(0);
    const lines = describeFirstSide(r).join("\n");
    expect(lines).toMatch(/NO BATTLE had an opening buy under 25%/);
    expect(lines).toMatch(/says nothing about skill/);
  });

  it("carries its own limit in the output, not only in the module comment", () => {
    const lines = describeFirstSide(firstSideReport([row("a", 900, 100, 40)])).join("\n");
    expect(lines).toMatch(/THE FIRST BUY MOVES THE OUTCOME IT IS BEING SCORED AGAINST/);
    expect(lines).toMatch(/skill, self-fulfilment, or any mix/);
  });

  it("refuses a hit rate when nothing was decided", () => {
    const lines = describeFirstSide(firstSideReport([row("b", 500, 500), row("a", 0, 0)])).join("\n");
    expect(lines).toMatch(/NONE of them settled with one pool larger/);
    expect(lines).not.toMatch(/larger final pool in/);
  });

  it("reports nothing read as nothing read", () => {
    expect(describeFirstSide(firstSideReport([])).join("\n")).toMatch(/NO OPENING SIDES READ/);
  });

  it("names no wallet and computes no profit", () => {
    const lines = describeFirstSide(firstSideReport([row("a", 900, 100, 40)])).join("\n");
    expect(lines).not.toMatch(/SOL|profit|P&L|wallet/i);
  });
});

/**
 * A small count printed without its small-sample behaviour invites a reading
 * it cannot support. The real run returned 9 of 12 in the subset where
 * self-fulfilment is least plausible, which looks like a finding and is not.
 */
describe("a count carries how often a coin does the same", () => {
  it("is the exact binomial tail", () => {
    // 299 / 4096, by hand.
    expect(coinTailProbability(9, 12)).toBeCloseTo(0.0730, 4);
    // The whole distribution sums to one, so "0 or more" is certain.
    expect(coinTailProbability(0, 12)).toBeCloseTo(1, 10);
    // And "all of them" is 2^-n.
    expect(coinTailProbability(12, 12)).toBeCloseTo(Math.pow(0.5, 12), 12);
    expect(coinTailProbability(1, 1)).toBeCloseTo(0.5, 12);
  });

  it("is null rather than a number when there is nothing to qualify", () => {
    expect(coinTailProbability(0, 0)).toBeNull();
    expect(coinTailProbability(5, 3)).toBeNull();
    expect(coinTailProbability(-1, 3)).toBeNull();
  });

  it("puts the tail beside the suggestive subset, so it cannot be quoted alone", () => {
    // 9 hits and 3 misses, each with an opening buy far under the margin.
    const rows: FirstSideRow[] = [];
    for (let i = 0; i < 9; i++) rows.push(row("a", 900, 100, 10, i));
    for (let i = 0; i < 3; i++) rows.push(row("b", 900, 100, 10, 100 + i));
    const lines = describeFirstSide(firstSideReport(rows)).join("\n");
    expect(lines).toMatch(/under 25% of the final margin: 9 of 12/);
    expect(lines).toMatch(/a fair coin gives 9 or more of 12 about 7% of the time/);
  });

  it("says <1% rather than rounding a small tail to zero", () => {
    const rows: FirstSideRow[] = [];
    for (let i = 0; i < 12; i++) rows.push(row("a", 900, 100, 10, i));
    expect(describeFirstSide(firstSideReport(rows)).join("\n")).toMatch(/about <1% of the time/);
  });
});
