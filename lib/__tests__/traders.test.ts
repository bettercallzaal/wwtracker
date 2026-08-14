import { describe, it, expect } from "vitest";
import { TRADERS, ME_WALLET, TREASURY_WALLET } from "@/lib/traders";
import { isValidSolanaAddress } from "@/lib/solana";

describe("TRADERS", () => {
  it("has at least 90 entries", () => {
    expect(TRADERS.length).toBeGreaterThanOrEqual(90);
  });

  it("every entry has required fields with correct types", () => {
    for (const t of TRADERS) {
      expect(typeof t.rank, `rank type for ${t.wallet}`).toBe("number");
      expect(t.wallet, `wallet empty at rank ${t.rank}`).toBeTruthy();
      expect(t.rec, `rec empty at rank ${t.rank}`).toBeTruthy();
      expect(typeof t.vol, `vol type at rank ${t.rank}`).toBe("number");
      expect(typeof t.trades, `trades type at rank ${t.rank}`).toBe("number");
      expect(typeof t.battles, `battles type at rank ${t.rank}`).toBe("number");
      expect(typeof t.win, `win type at rank ${t.rank}`).toBe("number");
      expect(typeof t.pnl, `pnl type at rank ${t.rank}`).toBe("number");
    }
  });

  it("ranks are unique", () => {
    const ranks = TRADERS.map((t) => t.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("ranks are sequential starting at 1", () => {
    const sorted = [...TRADERS].sort((a, b) => a.rank - b.rank);
    sorted.forEach((t, i) => {
      expect(t.rank).toBe(i + 1);
    });
  });

  it("wallets are unique", () => {
    const wallets = TRADERS.map((t) => t.wallet);
    expect(new Set(wallets).size).toBe(wallets.length);
  });

  it("win percentages are 0–100", () => {
    for (const t of TRADERS) {
      expect(t.win, `win out of range at rank ${t.rank}`).toBeGreaterThanOrEqual(0);
      expect(t.win, `win out of range at rank ${t.rank}`).toBeLessThanOrEqual(100);
    }
  });

  it("vol is non-negative", () => {
    for (const t of TRADERS) {
      expect(t.vol, `vol negative at rank ${t.rank}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("full wallet addresses are valid Solana base58", () => {
    for (const t of TRADERS) {
      if (t.wallet.includes("…")) continue;
      expect(isValidSolanaAddress(t.wallet), `invalid wallet at rank ${t.rank}`).toBe(true);
    }
  });
});

describe("ME_WALLET and TREASURY_WALLET", () => {
  it("ME_WALLET is a valid Solana address", () => {
    expect(isValidSolanaAddress(ME_WALLET)).toBe(true);
  });

  it("TREASURY_WALLET is a valid Solana address", () => {
    expect(isValidSolanaAddress(TREASURY_WALLET)).toBe(true);
  });

  it("ME_WALLET appears in TRADERS", () => {
    expect(TRADERS.some((t) => t.wallet === ME_WALLET)).toBe(true);
  });
});
