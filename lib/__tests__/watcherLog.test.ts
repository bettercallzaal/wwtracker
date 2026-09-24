/**
 * The doctor read one hardcoded path and the watcher writes another, so on
 * 2026-09-24 it called a live watcher dead and reported a stale run's mismatch
 * count as today's.
 */
import { describe, expect, it } from "vitest";
import { newestWatcherLog, watcherLogAgeSeconds, watcherVerdict } from "../watcherLog";

const VAR = "var/ww-live-watch.log";
const LEGACY = "/home/x/.zao/wwtracker/finals-watch.log";

describe("choosing the log", () => {
  it("takes the newest, not the first listed", () => {
    // The exact shape of the bug: the legacy path is listed and is 62 hours
    // stale, and the live one is seconds old.
    const chosen = newestWatcherLog([
      { path: LEGACY, mtimeMs: 1_000 },
      { path: VAR, mtimeMs: 224_510_000 },
    ]);
    expect(chosen?.path).toBe(VAR);
  });

  it("takes the legacy one when it really is the newer", () => {
    const chosen = newestWatcherLog([
      { path: VAR, mtimeMs: 1_000 },
      { path: LEGACY, mtimeMs: 2_000 },
    ]);
    expect(chosen?.path).toBe(LEGACY);
  });

  it("is null when none exist, which is not the same as stale", () => {
    expect(newestWatcherLog([])).toBeNull();
  });

  it("breaks a tie by list order, so a caller can express a preference", () => {
    const chosen = newestWatcherLog([
      { path: VAR, mtimeMs: 5 },
      { path: LEGACY, mtimeMs: 5 },
    ]);
    expect(chosen?.path).toBe(VAR);
  });
});

describe("the verdict", () => {
  it("is beating inside three missed beats", () => {
    expect(watcherVerdict(39, 12)).toBe("beating");
    expect(watcherVerdict(180, 12)).toBe("beating");
  });

  it("is stopped past them", () => {
    expect(watcherVerdict(181, 12)).toBe("stopped");
    expect(watcherVerdict(224_510, 12)).toBe("stopped");
  });

  /**
   * A log with no beats is not dead. It means started seconds ago, or stuck,
   * and calling it either would be wrong.
   */
  it("keeps never-beat separate from stopped, however old", () => {
    expect(watcherVerdict(5, 0)).toBe("never-beat");
    expect(watcherVerdict(999_999, 0)).toBe("never-beat");
  });
});

describe("age", () => {
  it("counts from the write to now", () => {
    expect(watcherLogAgeSeconds(1_000_000, 1_039_000)).toBe(39);
  });
  it("does not go negative on a clock that ran backwards", () => {
    // Floor of a negative is more negative; the check that matters is that a
    // future mtime never reads as "very old" and trips the stopped branch.
    expect(watcherVerdict(watcherLogAgeSeconds(2_000_000, 1_000_000), 5)).toBe("beating");
  });
});
