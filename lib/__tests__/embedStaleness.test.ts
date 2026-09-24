/**
 * The embeds are built to sit on somebody else's page, where nobody will think
 * to check when our baked files were last rebuilt.
 *
 * Measured 2026-09-24: `ww-platform-volume.json` and `ww-onchain-daily.json`
 * were 19 days old and `ww-battles.json` 15, and every chart drawn from them
 * said only "Series runs to 2026-09-05" - leaving a partner's reader to do the
 * arithmetic, if they thought to.
 */
import { describe, expect, it } from "vitest";
import { describeSnapshotAge, snapshotAgeDays } from "../snapshotAge";

/** 2026-09-24, the day the staleness was measured. */
const NOW = Date.parse("2026-09-24T12:00:00Z");

describe("a baked series says how old it is once that matters", () => {
  it("names the age of the files that were actually stale", () => {
    // ww-platform-volume.json and ww-onchain-daily.json, 19 days.
    expect(describeSnapshotAge("2026-09-05", NOW)).toMatch(/2026-09-05 \(19 days ago\)/);
    // ww-battles.json, 15 days.
    expect(describeSnapshotAge("2026-09-09", NOW)).toMatch(/2026-09-09 \(15 days ago\)/);
  });

  /**
   * A badge that always says something is a badge nobody reads, so it stays
   * quiet under a fortnight - a week-old all-time total is not misleading.
   */
  it("stays quiet under a fortnight, and speaks at it", () => {
    expect(describeSnapshotAge("2026-09-11", NOW)).toBe("2026-09-11");
    expect(snapshotAgeDays("2026-09-11", NOW)).toBe(13);
    expect(describeSnapshotAge("2026-09-10", NOW)).toMatch(/\(14 days ago\)/);
  });

  it("returns the stamp unchanged when it cannot be parsed, rather than inventing an age", () => {
    expect(describeSnapshotAge("not a date", NOW)).toBe("not a date");
    expect(snapshotAgeDays("not a date", NOW)).toBeNull();
  });

  it("never reports a negative age for a file stamped in the future", () => {
    expect(snapshotAgeDays("2026-10-01", NOW)).toBe(0);
    expect(describeSnapshotAge("2026-10-01", NOW)).toBe("2026-10-01");
  });
});
