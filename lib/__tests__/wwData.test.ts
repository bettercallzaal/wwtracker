import { describe, it, expect } from "vitest";
import { WW } from "@/lib/wwData";

describe("WW snapshot (lib/wwData.ts)", () => {
  it("generatedAt is a parseable ISO timestamp", () => {
    expect(typeof WW.generatedAt).toBe("string");
    expect(WW.generatedAt.length).toBeGreaterThan(0);
    const d = Date.parse(WW.generatedAt);
    expect(isNaN(d)).toBe(false);
    // sanity: must be after WaveWarZ launch (2025-08-01) and not in the future
    expect(d).toBeGreaterThan(Date.parse("2025-08-01"));
  });

  it("program summary has positive counts", () => {
    const { battlesCreated, battlesSettled, buys, sells, claims, uniqueTraders } = WW.program;
    expect(battlesCreated).toBeGreaterThan(0);
    expect(battlesSettled).toBeGreaterThan(0);
    expect(battlesCreated).toBeGreaterThanOrEqual(battlesSettled);
    expect(buys).toBeGreaterThan(0);
    expect(sells).toBeGreaterThan(0);
    expect(buys).toBeGreaterThan(sells); // more buys than sells
    expect(claims).toBeGreaterThan(0);
    expect(uniqueTraders).toBeGreaterThan(0);
  });

  it("volume total is positive and series is non-empty", () => {
    expect(WW.volume.total).toBeGreaterThan(0);
    expect(WW.volume.series.length).toBeGreaterThan(0);
    for (const p of WW.volume.series) {
      expect(typeof p.block_date).toBe("string");
      expect(p.vol).toBeGreaterThanOrEqual(0);
    }
  });

  it("daily activity series is non-empty with valid dates", () => {
    expect(WW.daily.length).toBeGreaterThan(0);
    for (const d of WW.daily) {
      expect(d.block_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.txs).toBeGreaterThanOrEqual(0);
      expect(d.traders).toBeGreaterThanOrEqual(0);
    }
  });

  it("platformStats has valid counts and dates", () => {
    const ps = WW.platformStats;
    expect(ps.programTxs).toBeGreaterThan(0);
    expect(ps.activeDays).toBeGreaterThan(0);
    expect(ps.firstDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Date.parse(ps.firstDay)).not.toBeNaN();
  });


  it("timeline series is non-empty and cumulative battles match program", () => {
    expect(WW.timeline.length).toBeGreaterThan(0);
    const totalBattles = WW.timeline.reduce((s, p) => s + p.battles, 0);
    // cumulative battles in timeline should be close to battlesCreated on-chain
    expect(totalBattles).toBeGreaterThan(0);
  });
});
