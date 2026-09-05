import { describe, it, expect } from "vitest";
import {
  decideRefresh,
  parseExecutionEndedAt,
  REFRESH_MIN_AGE_MS,
} from "@/lib/refresh-policy";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-09-05T09:00:00Z");

describe("REFRESH_MIN_AGE_MS", () => {
  // The cron runs daily. A threshold at or above 24h would let the cron block
  // its own next run, which is the freeze this whole module exists to prevent.
  it("leaves margin below the 24h cron period", () => {
    expect(REFRESH_MIN_AGE_MS).toBeLessThan(24 * HOUR);
    expect(REFRESH_MIN_AGE_MS).toBeGreaterThanOrEqual(12 * HOUR);
  });
});

describe("parseExecutionEndedAt", () => {
  it("reads execution_ended_at", () => {
    expect(
      parseExecutionEndedAt({ execution_ended_at: "2026-07-03T09:00:00Z" }),
    ).toBe(Date.parse("2026-07-03T09:00:00Z"));
  });

  it("prefers execution_ended_at over the earlier timestamps", () => {
    expect(
      parseExecutionEndedAt({
        submitted_at: "2026-07-03T08:00:00Z",
        execution_started_at: "2026-07-03T08:30:00Z",
        execution_ended_at: "2026-07-03T09:00:00Z",
      }),
    ).toBe(Date.parse("2026-07-03T09:00:00Z"));
  });

  it("falls back through started_at then submitted_at", () => {
    expect(
      parseExecutionEndedAt({ execution_started_at: "2026-07-03T08:30:00Z" }),
    ).toBe(Date.parse("2026-07-03T08:30:00Z"));
    expect(parseExecutionEndedAt({ submitted_at: "2026-07-03T08:00:00Z" })).toBe(
      Date.parse("2026-07-03T08:00:00Z"),
    );
  });

  it("returns null for a missing, non-string or unparseable timestamp", () => {
    expect(parseExecutionEndedAt(undefined)).toBeNull();
    expect(parseExecutionEndedAt(null)).toBeNull();
    expect(parseExecutionEndedAt({})).toBeNull();
    expect(parseExecutionEndedAt({ execution_ended_at: 1751533200000 })).toBeNull();
    expect(parseExecutionEndedAt({ execution_ended_at: "not a date" })).toBeNull();
  });
});

describe("decideRefresh", () => {
  it("executes when the stored result is older than the threshold", () => {
    const d = decideRefresh({ lastExecutionMs: NOW - 21 * HOUR, nowMs: NOW });
    expect(d).toEqual({ execute: true, reason: "stale", ageMs: 21 * HOUR });
  });

  it("declines when the stored result is fresh", () => {
    const d = decideRefresh({ lastExecutionMs: NOW - 2 * HOUR, nowMs: NOW });
    expect(d).toEqual({ execute: false, reason: "fresh", ageMs: 2 * HOUR });
  });

  it("executes exactly at the threshold", () => {
    const d = decideRefresh({
      lastExecutionMs: NOW - REFRESH_MIN_AGE_MS,
      nowMs: NOW,
    });
    expect(d.execute).toBe(true);
  });

  // The 64-day freeze in the flesh: without this the chart never moves again.
  it("executes against the execution that froze the chart for 64 days", () => {
    const d = decideRefresh({
      lastExecutionMs: Date.parse("2026-07-03T09:00:00Z"),
      nowMs: Date.parse("2026-09-05T09:00:00Z"),
    });
    expect(d.execute).toBe(true);
    expect(d.reason).toBe("stale");
  });

  it("fails open when the age is unknown", () => {
    expect(decideRefresh({ lastExecutionMs: null, nowMs: NOW })).toEqual({
      execute: true,
      reason: "unknown-age",
      ageMs: null,
    });
    expect(
      decideRefresh({ lastExecutionMs: Number.NaN, nowMs: NOW }).execute,
    ).toBe(true);
  });

  it("treats a future timestamp as age zero rather than as hugely stale", () => {
    const d = decideRefresh({ lastExecutionMs: NOW + 5 * HOUR, nowMs: NOW });
    expect(d).toEqual({ execute: false, reason: "fresh", ageMs: 0 });
  });

  it("honours an explicit threshold", () => {
    const d = decideRefresh({
      lastExecutionMs: NOW - 3 * HOUR,
      nowMs: NOW,
      minAgeMs: 2 * HOUR,
    });
    expect(d.execute).toBe(true);
  });

  // A daily cron must never be blocked by its own previous run.
  it("permits a run 24h after the last one", () => {
    expect(
      decideRefresh({ lastExecutionMs: NOW - 24 * HOUR, nowMs: NOW }).execute,
    ).toBe(true);
  });
});
