/**
 * A timestamp is not a statement about freshness.
 *
 * Three components print `WW.generatedAt` beside figures taken from it, and on
 * 2026-09-23 that read "2026-09-09T11:52Z" next to numbers a reader would take
 * as current. `scripts/validate.mjs` had been warning "18 days old" since
 * 2026-09-05 - where only a developer sees it.
 */
import { describe, expect, it } from "vitest";
import { describeSnapshotAge, snapshotAgeDays } from "../snapshotAge";

const NOW = Date.parse("2026-09-23T12:00:00Z");

describe("snapshotAgeDays", () => {
  it("counts whole days and never goes negative", () => {
    expect(snapshotAgeDays("2026-09-09T11:52:00Z", NOW)).toBe(14);
    expect(snapshotAgeDays("2026-09-23T11:00:00Z", NOW)).toBe(0);
    // A stamp from the future is a clock problem, not a negative age.
    expect(snapshotAgeDays("2026-10-01T00:00:00Z", NOW)).toBe(0);
  });

  it("is null for a stamp it cannot parse, rather than guessing", () => {
    expect(snapshotAgeDays("not a date", NOW)).toBeNull();
    expect(snapshotAgeDays("", NOW)).toBeNull();
  });
});

describe("describeSnapshotAge", () => {
  it("says the age once it is worth saying", () => {
    expect(describeSnapshotAge("2026-09-09T11:52:00Z", NOW)).toBe("2026-09-09T11:52:00Z (14 days ago)");
    expect(describeSnapshotAge("2026-09-05T00:00:00Z", NOW)).toMatch(/\(18 days ago\)/);
  });

  /** Fresh data must read as fresh, or the label becomes noise nobody reads. */
  it("stays quiet under a fortnight", () => {
    expect(describeSnapshotAge("2026-09-20T00:00:00Z", NOW)).toBe("2026-09-20T00:00:00Z");
    expect(describeSnapshotAge("2026-09-23T00:00:00Z", NOW)).toBe("2026-09-23T00:00:00Z");
  });

  it("returns an unparseable stamp untouched instead of hiding it", () => {
    expect(describeSnapshotAge("older", NOW)).toBe("older");
  });
});
