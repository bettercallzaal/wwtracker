import { describe, it, expect } from "vitest";
import { LEADERBOARD } from "@/lib/leaderboard";

describe("LEADERBOARD", () => {
  it("has at least 40 entries", () => {
    expect(LEADERBOARD.length).toBeGreaterThanOrEqual(40);
  });

  it("every entry has required fields with correct types", () => {
    for (const a of LEADERBOARD) {
      expect(typeof a.rank, `rank type for ${a.name}`).toBe("number");
      expect(a.name, `name empty at rank ${a.rank}`).toBeTruthy();
      expect(a.handle, `handle empty at rank ${a.rank}`).toBeTruthy();
      expect(a.wallet, `wallet empty at rank ${a.rank}`).toBeTruthy();
      expect(typeof a.win, `win type for ${a.name}`).toBe("number");
      expect(typeof a.vol, `vol type for ${a.name}`).toBe("number");
      expect(typeof a.earn, `earn type for ${a.name}`).toBe("number");
    }
  });

  it("ranks are unique", () => {
    const ranks = LEADERBOARD.map((a) => a.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("ranks are sequential starting at 1", () => {
    const sorted = [...LEADERBOARD].sort((a, b) => a.rank - b.rank);
    sorted.forEach((a, i) => {
      expect(a.rank).toBe(i + 1);
    });
  });

  it("win percentages are 0–100", () => {
    for (const a of LEADERBOARD) {
      expect(a.win, `win out of range for ${a.name}`).toBeGreaterThanOrEqual(0);
      expect(a.win, `win out of range for ${a.name}`).toBeLessThanOrEqual(100);
    }
  });

  it("vol and earn are non-negative", () => {
    for (const a of LEADERBOARD) {
      expect(a.vol, `vol negative for ${a.name}`).toBeGreaterThanOrEqual(0);
      expect(a.earn, `earn negative for ${a.name}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("wallets are unique (one wallet per row, even if artist has multiple rows)", () => {
    const wallets = LEADERBOARD.map((a) => a.wallet);
    expect(new Set(wallets).size).toBe(wallets.length);
  });
});
