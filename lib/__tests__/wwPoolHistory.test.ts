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
import { chartSeries, parseJsonl, serializeSample, shouldRecord, type PoolSample } from "../ww/poolHistory";
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
