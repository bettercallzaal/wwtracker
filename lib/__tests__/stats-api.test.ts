import { describe, it, expect } from "vitest";

const STATS_URL = "https://wavewarz.info/api/public/stats";

// Live network smoke test — verifies the public stats endpoint shape.
// Skipped in CI to avoid network flakiness; run locally with: npm test -- stats-api
describe.skipIf(process.env.CI)("stats API smoke (live network)", () => {
  it("returns 200 with correct content-type", async () => {
    const r = await fetch(STATS_URL);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toMatch(/json/);
  });

  it("response has all required top-level fields", async () => {
    const s = await fetch(STATS_URL).then((r) => r.json());
    expect(typeof s.updatedAt).toBe("string");
    expect(typeof s.solPriceUsd).toBe("number");
    expect(s.solPriceUsd).toBeGreaterThan(0);
    expect(s.volume).toBeDefined();
    expect(s.battles).toBeDefined();
    expect(s.artistPayouts).toBeDefined();
    expect(s.traderClaims).toBeDefined();
    // platformRevenue removed from API as of Jul 2026 — may be absent
    if (s.platformRevenue !== undefined) {
      expect(typeof s.platformRevenue.totalSol).toBe("number");
      expect(typeof s.platformRevenue.totalUsd).toBe("number");
    }
  });

  it("volume object has all sub-fields", async () => {
    const { volume } = await fetch(STATS_URL).then((r) => r.json());
    expect(typeof volume.totalSol).toBe("number");
    expect(typeof volume.totalUsd).toBe("number");
    expect(typeof volume.last24hSol).toBe("number");
    expect(typeof volume.last7dSol).toBe("number");
    expect(volume.totalSol).toBeGreaterThan(0);
  });

  it("battles object has all sub-fields", async () => {
    const { battles } = await fetch(STATS_URL).then((r) => r.json());
    expect(typeof battles.total).toBe("number");
    expect(typeof battles.mainEvents).toBe("number");
    expect(typeof battles.mainBattles).toBe("number");
    expect(typeof battles.quickBattles).toBe("number");
    expect(typeof battles.communityBattles).toBe("number");
    expect(battles.total).toBeGreaterThan(0);
  });

  it("traderClaims has withdrawalCount as integer", async () => {
    const { traderClaims } = await fetch(STATS_URL).then((r) => r.json());
    expect(Number.isInteger(traderClaims.withdrawalCount)).toBe(true);
    expect(traderClaims.withdrawalCount).toBeGreaterThan(0);
  });

  it("liveBattle is null or an object (never undefined)", async () => {
    const { liveBattle } = await fetch(STATS_URL).then((r) => r.json());
    // liveBattle key must exist in the response (can be null or an object)
    expect(liveBattle === null || typeof liveBattle === "object").toBe(true);
  });
});
