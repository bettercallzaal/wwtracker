import { describe, it, expect } from "vitest";
import { sampleBalances } from "@/lib/sampleData";

describe("sampleBalances", () => {
  it("returns the requested number of rows", () => {
    expect(sampleBalances(10)).toHaveLength(10);
    expect(sampleBalances(560)).toHaveLength(560);
  });

  it("is deterministic across calls (no Math.random/Date.now)", () => {
    expect(sampleBalances(50)).toEqual(sampleBalances(50));
  });

  it("produces consecutive ascending dates starting 2024-12-02", () => {
    const rows = sampleBalances(5);
    expect(rows[0].block_date).toBe("2024-12-02");
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].block_date > rows[i - 1].block_date).toBe(true);
    }
  });

  it("never produces a negative balance", () => {
    for (const row of sampleBalances(560)) {
      expect(row.eod_sol_balance).toBeGreaterThanOrEqual(0);
    }
  });

  it("trends toward the ~3.5-3.7 operating floor by the end of the series", () => {
    const rows = sampleBalances(560);
    const last = rows[rows.length - 1].eod_sol_balance;
    expect(last).toBeGreaterThan(3);
    expect(last).toBeLessThan(4);
  });
});
