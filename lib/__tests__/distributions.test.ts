import { describe, it, expect } from "vitest";
import {
  FLOOR_SOL,
  RECIPIENTS,
  getDistributionBreakdown,
} from "@/lib/distributions";

describe("distributions", () => {
  it("operating floor is 3.5 SOL", () => {
    expect(FLOOR_SOL).toBe(3.5);
  });

  it("split is 33 / 22 / 22 / 22", () => {
    expect(RECIPIENTS.map((r) => r.percent)).toEqual([33, 22, 22, 22]);
  });

  it("returns an all-null map when the total is null (TBD)", () => {
    const b = getDistributionBreakdown(null);
    expect(Object.values(b).every((v) => v === null)).toBe(true);
  });

  it("splits a total by percent", () => {
    const b = getDistributionBreakdown(10);
    expect(b["WaveWarZ operations"]).toBe(3.3);
    expect(b["Hurricane"]).toBe(2.2);
    expect(b["Candy"]).toBe(2.2);
    expect(b["Zaal"]).toBe(2.2);
  });

  it("distributes 99% of the total (33 + 22*3, the model)", () => {
    const b = getDistributionBreakdown(100) as Record<string, number>;
    const sum = Object.values(b).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(99, 5);
  });
});
