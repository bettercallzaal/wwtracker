import { describe, it, expect } from "vitest";
import { normalizeRows, toNumber } from "@/lib/dune-normalize";

describe("toNumber", () => {
  it("parses numeric strings", () => {
    expect(toNumber("3.51")).toBe(3.51);
  });
  it("passes through real numbers", () => {
    expect(toNumber(3.51)).toBe(3.51);
  });
  it("falls back to 0 for non-finite/invalid input", () => {
    expect(toNumber("not a number")).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });
});

describe("normalizeRows", () => {
  it("returns an empty array for non-array input", () => {
    expect(normalizeRows(undefined)).toEqual([]);
    expect(normalizeRows(null)).toEqual([]);
    expect(normalizeRows({})).toEqual([]);
  });

  it("accepts the native-SOL column name (eod_sol_balance)", () => {
    const rows = normalizeRows([{ block_date: "2026-06-15", eod_sol_balance: "3.51" }]);
    expect(rows).toEqual([{ block_date: "2026-06-15", eod_sol_balance: 3.51, day_high: 3.51 }]);
  });

  it("falls back through the column alias chain for SPL-token queries", () => {
    const rows = normalizeRows([{ block_date: "2026-06-15", eod_token_balance: 1.2 }]);
    expect(rows[0].eod_sol_balance).toBe(1.2);

    const rows2 = normalizeRows([{ block_date: "2026-06-15", eod_balance: 2.3 }]);
    expect(rows2[0].eod_sol_balance).toBe(2.3);

    const rows3 = normalizeRows([{ block_date: "2026-06-15", balance: 4.5 }]);
    expect(rows3[0].eod_sol_balance).toBe(4.5);
  });

  it("uses eod_sol_balance as the day_high fallback when day_high is absent", () => {
    const rows = normalizeRows([{ block_date: "2026-06-15", eod_sol_balance: 3.2 }]);
    expect(rows[0].day_high).toBe(3.2);
  });

  it("keeps an explicit day_high distinct from the close", () => {
    const rows = normalizeRows([{ block_date: "2026-06-15", eod_sol_balance: 3.51, day_high: 4.65 }]);
    expect(rows[0].day_high).toBe(4.65);
  });

  it("truncates a full timestamp to YYYY-MM-DD", () => {
    const rows = normalizeRows([{ block_date: "2026-06-15T00:00:00Z", eod_sol_balance: 1 }]);
    expect(rows[0].block_date).toBe("2026-06-15");
  });

  it("drops rows with a missing or non-string block_date", () => {
    const rows = normalizeRows([
      { eod_sol_balance: 1 },
      { block_date: 12345, eod_sol_balance: 1 },
      { block_date: "2026-06-15", eod_sol_balance: 1 },
    ]);
    expect(rows).toHaveLength(1);
  });

  it("drops non-object entries without throwing", () => {
    const rows = normalizeRows([null, "not a row", 42, { block_date: "2026-06-15", eod_sol_balance: 1 }]);
    expect(rows).toHaveLength(1);
  });

  it("sorts the result by block_date ascending regardless of input order", () => {
    const rows = normalizeRows([
      { block_date: "2026-06-17", eod_sol_balance: 3 },
      { block_date: "2026-06-15", eod_sol_balance: 1 },
      { block_date: "2026-06-16", eod_sol_balance: 2 },
    ]);
    expect(rows.map((r) => r.block_date)).toEqual(["2026-06-15", "2026-06-16", "2026-06-17"]);
  });
});
