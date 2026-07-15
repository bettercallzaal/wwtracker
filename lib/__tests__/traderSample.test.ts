import { describe, it, expect } from "vitest";
import { sampleTraderPnl } from "@/lib/traderSample";

describe("sampleTraderPnl", () => {
  it("returns the requested number of points, 1-indexed", () => {
    const points = sampleTraderPnl(10);
    expect(points).toHaveLength(10);
    expect(points[0].battle).toBe(1);
    expect(points[9].battle).toBe(10);
  });

  it("is deterministic across calls (no Math.random/Date.now)", () => {
    expect(sampleTraderPnl(50)).toEqual(sampleTraderPnl(50));
  });

  it("ends exactly at the given endPnl", () => {
    const points = sampleTraderPnl(120, -1.6493);
    expect(points[points.length - 1].cumPnl).toBeCloseTo(-1.6493, 4);
  });

  it("ends at a different endPnl when given one", () => {
    const points = sampleTraderPnl(30, 2.5);
    expect(points[points.length - 1].cumPnl).toBeCloseTo(2.5, 4);
  });
});
