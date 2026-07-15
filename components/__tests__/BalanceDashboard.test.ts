import { describe, it, expect } from "vitest";
import { toWeekly } from "@/components/BalanceDashboard";

describe("toWeekly", () => {
  it("buckets daily rows by the Monday of their week (UTC)", () => {
    // 2026-06-15 is a Monday, 2026-06-17 a Wednesday - same week.
    const rows = [
      { block_date: "2026-06-15", eod_sol_balance: 3.0 },
      { block_date: "2026-06-17", eod_sol_balance: 3.2 },
    ];
    const weekly = toWeekly(rows);
    expect(weekly).toHaveLength(1);
    expect(weekly[0].block_date).toBe("2026-06-15");
  });

  it("uses the last row of the week as the close (rows must be ascending)", () => {
    const rows = [
      { block_date: "2026-06-15", eod_sol_balance: 3.0 },
      { block_date: "2026-06-16", eod_sol_balance: 3.1 },
      { block_date: "2026-06-17", eod_sol_balance: 3.51 },
    ];
    const weekly = toWeekly(rows);
    expect(weekly[0].eod_sol_balance).toBe(3.51);
  });

  it("carries the week's peak intraday high, not just the close", () => {
    const rows = [
      { block_date: "2026-06-15", eod_sol_balance: 3.0, day_high: 4.65 },
      { block_date: "2026-06-16", eod_sol_balance: 3.1, day_high: 3.2 },
    ];
    const weekly = toWeekly(rows);
    expect(weekly[0].day_high).toBe(4.65);
  });

  it("falls back to eod_sol_balance as the high when day_high is absent", () => {
    const rows = [{ block_date: "2026-06-15", eod_sol_balance: 3.4 }];
    const weekly = toWeekly(rows);
    expect(weekly[0].day_high).toBe(3.4);
  });

  it("buckets a Sunday into the week that just ended (prior Monday), not the next week", () => {
    // 2026-06-14 is a Sunday - the week is 2026-06-08 (Mon) through 2026-06-14 (Sun).
    const rows = [{ block_date: "2026-06-14", eod_sol_balance: 2.9 }];
    const weekly = toWeekly(rows);
    expect(weekly[0].block_date).toBe("2026-06-08");
  });

  it("produces separate buckets for separate weeks, sorted ascending", () => {
    const rows = [
      { block_date: "2026-06-22", eod_sol_balance: 3.6 }, // week of 2026-06-22
      { block_date: "2026-06-15", eod_sol_balance: 3.0 }, // week of 2026-06-15
    ];
    const weekly = toWeekly(rows);
    expect(weekly.map((r) => r.block_date)).toEqual(["2026-06-15", "2026-06-22"]);
  });

  it("returns an empty array for empty input", () => {
    expect(toWeekly([])).toEqual([]);
  });
});
