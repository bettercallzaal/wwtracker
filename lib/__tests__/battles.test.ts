import { describe, it, expect } from "vitest";
import { BATTLE_STATS, RECENT_BATTLES } from "@/lib/battles";

describe("BATTLE_STATS", () => {
  it("has all required numeric fields", () => {
    const fields: (keyof typeof BATTLE_STATS)[] = [
      "events", "quickBattles", "multiRound", "totalShown",
      "totalVolumeSol", "artistPayoutsSol", "platformRevenueSol",
    ];
    for (const f of fields) {
      expect(typeof BATTLE_STATS[f], f).toBe("number");
      expect(BATTLE_STATS[f], f).toBeGreaterThan(0);
    }
  });

  it("totalShown is at least quickBattles + multiRound", () => {
    expect(BATTLE_STATS.totalShown).toBeGreaterThanOrEqual(
      BATTLE_STATS.quickBattles + BATTLE_STATS.multiRound
    );
  });

  it("artist payouts are less than total volume", () => {
    expect(BATTLE_STATS.artistPayoutsSol).toBeLessThan(BATTLE_STATS.totalVolumeSol);
  });

  it("platform revenue is less than total volume", () => {
    expect(BATTLE_STATS.platformRevenueSol).toBeLessThan(BATTLE_STATS.totalVolumeSol);
  });
});

describe("RECENT_BATTLES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(RECENT_BATTLES)).toBe(true);
    expect(RECENT_BATTLES.length).toBeGreaterThan(0);
  });

  it("every entry has the expected shape", () => {
    for (const b of RECENT_BATTLES) {
      expect(["MAIN", "QUICK"]).toContain(b.type);
      expect(typeof b.a).toBe("string");
      expect(typeof b.b).toBe("string");
      expect(typeof b.winner).toBe("string");
      expect(typeof b.vol).toBe("number");
      expect(b.vol).toBeGreaterThanOrEqual(0);
      expect(typeof b.date).toBe("string");
    }
  });
});
