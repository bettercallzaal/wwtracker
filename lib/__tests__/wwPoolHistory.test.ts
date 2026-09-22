/**
 * The chart store: what the watcher keeps, how it is spelled, how it is read.
 *
 * The watcher has polled every live battle every 3 s since 2026-09-19 and kept
 * nothing anyone could plot. These pin the three decisions that turn its polls
 * into a series: changes always kept, flat stretches kept on a heartbeat so
 * they read as measured rather than missing, and a torn last line skipped
 * rather than fatal.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chartSeries, newestBattleId, parseJsonl, recordingState, serializeSample, shouldRecord, type PoolSample } from "../ww/poolHistory";
import { historyPath, readHistory, recordSample } from "../poolHistoryStore";

const s = (t: number, a = 1_000_000_000, b = 2_000_000_000, sa = 100_000, sb = 200_000): PoolSample => ({ t, a, b, sa, sb });

describe("shouldRecord", () => {
  it("keeps the first sample", () => {
    expect(shouldRecord(null, s(0))).toBe(true);
  });
  it("keeps any change in a pool or a supply, however small", () => {
    expect(shouldRecord(s(0), s(1, 1_000_000_001))).toBe(true);
    expect(shouldRecord(s(0), s(1, 1_000_000_000, 2_000_000_000, 100_001))).toBe(true);
  });
  it("drops an unchanged sample inside the heartbeat, keeps it at the heartbeat", () => {
    expect(shouldRecord(s(0), s(3))).toBe(false);
    expect(shouldRecord(s(0), s(29))).toBe(false);
    expect(shouldRecord(s(0), s(30))).toBe(true);
  });
});

describe("serializeSample and parseJsonl", () => {
  it("round-trips, one object per line, fixed key order", () => {
    const line = serializeSample(s(7));
    expect(line).toBe('{"t":7,"a":1000000000,"b":2000000000,"sa":100000,"sb":200000}');
    expect(parseJsonl(line + "\n" + serializeSample(s(8)) + "\n")).toEqual({ samples: [s(7), s(8)], skipped: 0 });
  });

  /**
   * A watcher killed mid-write leaves a torn last line. One torn line must not
   * blank a whole battle's chart.
   */
  it("skips a torn line and counts it, keeping the rest", () => {
    const text = serializeSample(s(1)) + "\n" + '{"t":2,"a":10' + "\n" + serializeSample(s(3)) + "\n";
    expect(parseJsonl(text)).toEqual({ samples: [s(1), s(3)], skipped: 1 });
  });

  it("skips a line with the wrong shape rather than inventing zeros", () => {
    expect(parseJsonl('{"t":1,"a":"x","b":2,"sa":3,"sb":4}\n')).toEqual({ samples: [], skipped: 1 });
  });
});

describe("chartSeries", () => {
  it("sorts by time, converts to SOL, and collapses duplicate times to the last", () => {
    const series = chartSeries([s(5, 3_000_000_000), s(1), s(5, 4_000_000_000)]);
    expect(series).toEqual([
      { t: 1, aSol: 1, bSol: 2 },
      { t: 5, aSol: 4, bSol: 2 },
    ]);
  });
});

describe("the store on disk", () => {
  it("appends per battle, creates the directory, and reads back what it wrote", () => {
    const dir = mkdtempSync(join(tmpdir(), "ww-live-"));
    try {
      recordSample(dir, 1789948124, s(1));
      recordSample(dir, 1789948124, s(2));
      recordSample(dir, 1789790992, s(3));
      expect(readFileSync(historyPath(dir, 1789948124), "utf8").split("\n").filter(Boolean)).toHaveLength(2);
      expect(readHistory(dir, 1789948124)).toEqual({ samples: [s(1), s(2)], skipped: 0 });
      expect(readHistory(dir, 1789790992)).toEqual({ samples: [s(3)], skipped: 0 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("answers null for a battle never watched, not an empty series", () => {
    const dir = mkdtempSync(join(tmpdir(), "ww-live-"));
    try {
      expect(readHistory(dir, 1700000000)).toBeNull();
      writeFileSync(historyPath(dir, 1700000000), "");
      expect(readHistory(dir, 1700000000)).toEqual({ samples: [], skipped: 0 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a path for an id that is not a battle id", () => {
    expect(() => historyPath("/tmp", 12)).toThrow(/9 to 12/);
  });
});

/**
 * A dead watcher must not look like a quiet market. While a battle is live
 * the heartbeat guarantees a sample every 30 s, so an old newest sample is
 * the watcher's absence, not the market's silence.
 */
describe("recordingState", () => {
  it("is none with no samples", () => {
    expect(recordingState(null, 1000, true)).toBe("none");
  });
  it("is recording while the newest sample is inside heartbeat plus two polls", () => {
    expect(recordingState(1000, 1000 + 30 + 6, true)).toBe("recording");
  });
  it("is stale on a live battle once the heartbeat has been missed", () => {
    expect(recordingState(1000, 1000 + 30 + 7, true)).toBe("stale");
  });
  it("never calls a settled battle stale", () => {
    expect(recordingState(1000, 1000 + 86_400, false)).toBe("recording");
  });
});

/**
 * "Latest" is the battle that started last, and a battle id IS its start time.
 * Ranking by file modification time instead put a just-ended battle ahead of
 * the one that had just opened, because the watcher writes heartbeats through
 * the 300 s grace window. Measured live 2026-09-21: /battle/latest pointed at
 * a finished battle while another was trading.
 */
describe("newestBattleId", () => {
  it("takes the largest id, which is the latest start time", () => {
    expect(newestBattleId([1790042941, 1790043661, 1790041886])).toBe(1790043661);
  });
  it("is null when nothing is recorded", () => {
    expect(newestBattleId([])).toBeNull();
  });
  it("ignores anything that is not a positive whole id", () => {
    expect(newestBattleId([0, -5, 1.5, 1790043661])).toBe(1790043661);
    expect(newestBattleId([0, -5])).toBeNull();
  });
});
