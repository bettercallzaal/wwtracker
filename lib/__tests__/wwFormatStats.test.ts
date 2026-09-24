/**
 * `brand/FORMATS.md` was built from the 200 most recent battles the public API
 * returns, and said so as a limitation. The refresh that had never been
 * automated brought the file to 1,574 labelled battles spanning the whole
 * history, and the same table over that sample says different things.
 */
import { describe, expect, it } from "vitest";
import {
  buildFormatReport,
  durationHistogram,
  median,
  type ChainBattle,
  type LabelledBattle,
} from "../ww/formatStats";

const chain = (battleId: number, seconds: number, pool: number): ChainBattle => ({
  battleId,
  startTime: 1_700_000_000,
  endTime: 1_700_000_000 + seconds,
  poolLamports: { a: pool, b: 0 },
});

describe("median", () => {
  it("is null on an empty sample rather than zero", () => {
    expect(median([])).toBeNull();
  });

  /**
   * Even counts take the lower middle rather than averaging, so a median
   * duration is always a duration some battle actually ran.
   */
  it("returns a member of the sample, even on an even count", () => {
    expect(median([300, 900])).toBe(300);
    expect(median([5, 1, 3])).toBe(3);
  });
});

describe("the join", () => {
  const labelled: LabelledBattle[] = [
    { id: 1, type: "quick" },
    { id: 2, type: "quick" },
    { id: 3, type: "main" },
  ];

  it("reports a labelled battle with no account rather than dropping it", () => {
    const r = buildFormatReport(labelled, [chain(1, 480, 100), chain(2, 500, 200)]);
    expect(r.matched).toBe(2);
    expect(r.unmatched).toBe(1);
    // And the format it belonged to is absent, not silently one short.
    expect(r.stats.find((s) => s.type === "main")).toBeUndefined();
  });

  it("counts chain accounts nothing labelled, which is not a fault", () => {
    // The public API lists its own battles; 135 accounts carry no label.
    const r = buildFormatReport([{ id: 1, type: "quick" }], [chain(1, 480, 100), chain(99, 480, 100)]);
    expect(r.unlabelled).toBe(1);
  });
});

describe("per-format numbers", () => {
  it("medians the pool over TRADED battles only", () => {
    // Counting the empty one would drag the median to zero and describe a
    // format nobody traded as one with no money in it.
    const r = buildFormatReport(
      [
        { id: 1, type: "quick" },
        { id: 2, type: "quick" },
        { id: 3, type: "quick" },
      ],
      [chain(1, 480, 0), chain(2, 480, 100), chain(3, 480, 300)],
    );
    const q = r.stats[0];
    expect(q.battles).toBe(3);
    expect(q.traded).toBe(2);
    expect(q.medianPoolLamports).toBe(100);
    expect(q.maxPoolLamports).toBe(300);
  });

  it("excludes a clock that did not advance from the durations, keeping it in the count", () => {
    const r = buildFormatReport(
      [
        { id: 1, type: "quick" },
        { id: 2, type: "quick" },
      ],
      [chain(1, 0, 100), chain(2, 480, 100)],
    );
    expect(r.stats[0].battles).toBe(2);
    expect(r.stats[0].medianDurationSeconds).toBe(480);
    expect(r.stats[0].minDurationSeconds).toBe(480);
  });

  it("says none-traded rather than zero when a format saw no money at all", () => {
    const r = buildFormatReport([{ id: 1, type: "community" }], [chain(1, 1800, 0)]);
    expect(r.stats[0].medianPoolLamports).toBeNull();
    expect(r.stats[0].maxPoolLamports).toBeNull();
  });

  it("orders formats by how many battles they have", () => {
    const r = buildFormatReport(
      [
        { id: 1, type: "main" },
        { id: 2, type: "quick" },
        { id: 3, type: "quick" },
      ],
      [chain(1, 900, 1), chain(2, 480, 1), chain(3, 480, 1)],
    );
    expect(r.stats.map((s) => s.type)).toEqual(["quick", "main"]);
  });
});

describe("the duration histogram", () => {
  it("ranks by how many battles ran exactly that long", () => {
    const h = durationHistogram([chain(1, 1260, 1), chain(2, 1260, 1), chain(3, 900, 1)], 2);
    expect(h).toEqual([
      { seconds: 1260, battles: 2 },
      { seconds: 900, battles: 1 },
    ]);
  });

  it("ignores a clock that did not advance", () => {
    expect(durationHistogram([chain(1, 0, 1)])).toEqual([]);
  });
});
