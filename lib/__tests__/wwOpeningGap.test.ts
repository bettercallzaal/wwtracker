/**
 * The opening-gap report must keep three different facts apart: a battle
 * nobody traded, a battle this client could not read, and a battle it never
 * asked about. All three have historically come back as an empty row.
 */
import { describe, expect, it } from "vitest";
import {
  buildOpeningGaps,
  countWithin,
  describeOpeningGaps,
  percentile,
  type FirstTrade,
  type Opening,
} from "../ww/openingGap";

const opening = (battleId: number, startTime: number, mintsReadyTime: number | null = null): Opening => ({
  battleId,
  startTime,
  endTime: startTime + 600,
  mintsReadyTime,
});
const trade = (blockTime: number, kind: "buy" | "sell" = "buy"): FirstTrade => ({
  signature: `sig${blockTime}`,
  blockTime,
  kind,
});

describe("an absence, a failure and a question never asked are three answers", () => {
  const openings = [opening(1, 1_000), opening(2, 2_000), opening(3, 3_000), opening(4, 4_000)];

  it("separates them", () => {
    const r = buildOpeningGaps(
      openings,
      new Map<number, FirstTrade | null>([
        [1, trade(1_066)],
        [2, null], // asked, and there were no trades
        // 4 is absent from the map entirely: never fetched
      ]),
      new Map([[3, "signatures: 429 after 6 attempts"]]),
    );

    expect(r.asked).toBe(4);
    expect(r.gaps).toHaveLength(1);
    expect(r.gaps[0].gapSeconds).toBe(66);
    expect(r.missed).toEqual([
      { battleId: 2, reason: "no-trades" },
      { battleId: 3, reason: "unreadable", detail: "signatures: 429 after 6 attempts" },
      { battleId: 4, reason: "unreadable", detail: "never fetched" },
    ]);
  });

  it("names the unreadable ones in the words, so a thin sample cannot read as a clean one", () => {
    const lines = describeOpeningGaps(
      buildOpeningGaps(openings, new Map([[1, trade(1_066)]]), new Map([[3, "boom"]])),
    ).join("\n");
    expect(lines).toMatch(/1 of 4 battles gave a first trade/);
    expect(lines).toMatch(/COULD NOT BE READ/);
    expect(lines).toMatch(/boom/);
  });
});

describe("it refuses to be read as the announcement lag", () => {
  it("says so in the report itself, not only in the module comment", () => {
    const lines = describeOpeningGaps(
      buildOpeningGaps([opening(1, 1_000)], new Map([[1, trade(1_020)]])),
    ).join("\n");
    expect(lines).toMatch(/UPPER BOUND/);
    expect(lines).toMatch(/not the announcement lag/);
    expect(lines).toMatch(/ww-mark\.sh/);
  });

  it("states a count against its denominator, never a bare percentage", () => {
    const r = buildOpeningGaps(
      [opening(1, 1_000), opening(2, 2_000), opening(3, 3_000)],
      new Map([
        [1, trade(1_020)],
        [2, trade(2_044)],
        [3, trade(3_100)],
      ]),
    );
    expect(countWithin(r.gaps, 45)).toEqual({ within: 2, of: 3 });
    expect(describeOpeningGaps(r).join("\n")).toMatch(/2 of 3 battles saw their first trade within 45s/);
  });

  it("says plainly that nothing was measured when nothing was", () => {
    const lines = describeOpeningGaps(
      buildOpeningGaps([opening(1, 1_000)], new Map([[1, null]])),
    ).join("\n");
    expect(lines).toMatch(/NO GAPS MEASURED/);
    expect(lines).not.toMatch(/median/);
  });
});

describe("a trade before the recorded open is reported, not clamped", () => {
  it("keeps the negative gap", () => {
    const r = buildOpeningGaps([opening(1, 1_000)], new Map([[1, trade(980, "sell")]]));
    expect(r.gaps[0].gapSeconds).toBe(-20);
  });
});

describe("percentile", () => {
  it("is null on an empty sample rather than 0", () => {
    expect(percentile([], 50)).toBeNull();
  });
  it("returns a member of the sample", () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40, 50], 100)).toBe(50);
  });
});

/**
 * The two clocks, and the correction that matters more than either.
 *
 * `start_time` is the battle id, minted before the battle exists on chain. No
 * buy can land until `initializeMints` does - AND NOT UNTIL `start_time` + 60
 * SECONDS, which the program enforces (`tradeWindow.ts`, measured: 59s
 * refused, 60s accepted). Measuring from the mints alone was too generous by
 * whatever remained of that gate.
 */
describe("the tradeable moment is the later of the mints and the 60-second gate", () => {
  it("measures from the gate when the gate is later, which on real battles it is", () => {
    // The three real battles probed 2026-09-23, in their measured numbers.
    const r = buildOpeningGaps(
      [
        opening(1789948124, 1_789_948_124, 1_789_948_124 + 32),
        opening(1789442838, 1_789_442_838, 1_789_442_838 + 10),
        opening(1789177998, 1_789_177_998, 1_789_177_998 + 10),
      ],
      new Map([
        [1789948124, trade(1_789_948_124 + 66)],
        [1789442838, trade(1_789_442_838 + 66)],
        [1789177998, trade(1_789_177_998 + 67)],
      ]),
    );
    expect(r.gaps.map((g) => g.gapSeconds)).toEqual([66, 66, 67]);
    // THE WHOLE CORRECTION IN ONE ASSERTION. Measured from the mints these
    // were 34, 56 and 57 seconds, and the spread invited a story about who was
    // watching what. Measured from when a buy could actually land, they are 6,
    // 6 and 7 - the first trade arrives within seconds of the gate opening,
    // every time, and there is nothing left to explain with behaviour.
    expect(r.gaps.map((g) => g.gapFromTradeableSeconds)).toEqual([6, 6, 7]);

    const lines = describeOpeningGaps(r).join("\n");
    expect(lines).toMatch(/from start_time to first trade/);
    expect(lines).toMatch(/refuses every buy until start_time \+ 60s/);
    expect(lines).toMatch(/gate and not the/);
    expect(lines).toMatch(/the launch itself took median 10s \(10s to 32s\)/);
  });

  it("says the tradeable open is UNKNOWN rather than defaulting it to start_time", () => {
    const r = buildOpeningGaps([opening(1, 1_000)], new Map([[1, trade(1_066)]]));
    expect(r.gaps[0].gapFromTradeableSeconds).toBeNull();
    const lines = describeOpeningGaps(r).join("\n");
    expect(lines).toMatch(/TRADEABLE OPEN UNKNOWN/);
    // Never a number invented from the one clock it does have.
    expect(lines).not.toMatch(/from initializeMints/);
  });

  it("counts only the battles whose tradeable open is known, against that denominator", () => {
    const r = buildOpeningGaps(
      // Mints at +10, so the 60s gate binds: tradeable at 1,060, trade at 1,070.
      [opening(1, 1_000, 1_010), opening(2, 2_000)],
      new Map([
        [1, trade(1_070)],
        [2, trade(2_030)],
      ]),
    );
    expect(r.gaps[0].gapFromTradeableSeconds).toBe(10);
    const lines = describeOpeningGaps(r, 45).join("\n");
    expect(lines).toMatch(/over 1 of 2 battles/);
    expect(lines).toMatch(/1 of 1 of those traded within 45s of becoming tradeable/);
  });

  it("uses the MINTS when they are the later of the two", () => {
    // Mints at +200, well past the 60s gate, so they bind instead.
    const r = buildOpeningGaps([opening(1, 1_000, 1_200)], new Map([[1, trade(1_210)]]));
    expect(r.gaps[0].gapFromTradeableSeconds).toBe(10);
    expect(describeOpeningGaps(r).join("\n")).toMatch(/gate and not the/);
  });
});
