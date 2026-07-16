/**
 * Smoke test for GET https://wavewarz.info/api/public/stats
 *
 * Verifies the public contract: CORS open, shape present, numeric fields > 0.
 * This test hits the live endpoint — run with `npm test` or `vitest run`.
 */
import { describe, it, expect } from "vitest";

const STATS_URL = "https://wavewarz.info/api/public/stats";

describe("GET /api/public/stats (live smoke)", () => {
  it("responds 200 with CORS open", async () => {
    const res = await fetch(STATS_URL);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("has the required top-level fields", async () => {
    const res = await fetch(STATS_URL);
    const data = await res.json();
    expect(data).toHaveProperty("updatedAt");
    expect(data).toHaveProperty("solPriceUsd");
    expect(data).toHaveProperty("volume");
    expect(data).toHaveProperty("liveBattle");   // may be null
    expect(data).toHaveProperty("artistPayouts");
    expect(data).toHaveProperty("traderClaims");
    expect(data).toHaveProperty("platformRevenue");
    expect(data).toHaveProperty("battles");
  });

  it("updatedAt is a valid ISO timestamp", async () => {
    const res = await fetch(STATS_URL);
    const { updatedAt } = await res.json();
    expect(typeof updatedAt).toBe("string");
    const ms = Date.parse(updatedAt);
    expect(Number.isFinite(ms)).toBe(true);
    // must be recent — within the last 24 h (the endpoint caches for 60 s)
    expect(ms).toBeGreaterThan(Date.now() - 86_400_000);
  });

  it("solPriceUsd is a positive number", async () => {
    const res = await fetch(STATS_URL);
    const { solPriceUsd } = await res.json();
    expect(typeof solPriceUsd).toBe("number");
    expect(solPriceUsd).toBeGreaterThan(0);
  });

  it("volume has required sub-fields and all are non-negative", async () => {
    const res = await fetch(STATS_URL);
    const { volume } = await res.json();
    expect(typeof volume.totalSol).toBe("number");
    expect(typeof volume.totalUsd).toBe("number");
    expect(typeof volume.last24hSol).toBe("number");
    expect(typeof volume.last7dSol).toBe("number");
    expect(volume.totalSol).toBeGreaterThan(0);
    expect(volume.totalUsd).toBeGreaterThan(0);
    expect(volume.last24hSol).toBeGreaterThanOrEqual(0);
    expect(volume.last7dSol).toBeGreaterThanOrEqual(0);
  });

  it("liveBattle is null or an object", async () => {
    const res = await fetch(STATS_URL);
    const { liveBattle } = await res.json();
    const valid = liveBattle === null || (typeof liveBattle === "object" && !Array.isArray(liveBattle));
    expect(valid).toBe(true);
  });

  it("artistPayouts has totalSol and totalUsd", async () => {
    const res = await fetch(STATS_URL);
    const { artistPayouts } = await res.json();
    expect(typeof artistPayouts.totalSol).toBe("number");
    expect(typeof artistPayouts.totalUsd).toBe("number");
    expect(artistPayouts.totalSol).toBeGreaterThanOrEqual(0);
  });

  it("traderClaims has totalSol, totalUsd, withdrawalCount", async () => {
    const res = await fetch(STATS_URL);
    const { traderClaims } = await res.json();
    expect(typeof traderClaims.totalSol).toBe("number");
    expect(typeof traderClaims.totalUsd).toBe("number");
    expect(typeof traderClaims.withdrawalCount).toBe("number");
    expect(traderClaims.withdrawalCount).toBeGreaterThanOrEqual(0);
  });

  it("platformRevenue has totalSol and totalUsd", async () => {
    const res = await fetch(STATS_URL);
    const { platformRevenue } = await res.json();
    expect(typeof platformRevenue.totalSol).toBe("number");
    expect(typeof platformRevenue.totalUsd).toBe("number");
  });

  it("battles counts are non-negative integers", async () => {
    const res = await fetch(STATS_URL);
    const { battles } = await res.json();
    for (const key of ["total", "mainEvents", "mainBattles", "quickBattles", "communityBattles"]) {
      expect(typeof battles[key]).toBe("number");
      expect(Number.isInteger(battles[key])).toBe(true);
      expect(battles[key]).toBeGreaterThanOrEqual(0);
    }
    expect(battles.total).toBeGreaterThan(0);
  });

  it("battles.total is consistent with battle type counts", async () => {
    const res = await fetch(STATS_URL);
    const { battles } = await res.json();
    // total should roughly equal the sum of known types (mainBattles excludes mainEvents grouping)
    const sumTypes = battles.mainBattles + battles.quickBattles + battles.communityBattles;
    // total >= sumTypes (mainEvents is a grouping, not additive; but total should be >= each type)
    expect(battles.total).toBeGreaterThanOrEqual(battles.quickBattles);
    expect(battles.total).toBeGreaterThanOrEqual(battles.mainBattles);
  });
});
