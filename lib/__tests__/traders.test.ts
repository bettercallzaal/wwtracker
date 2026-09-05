import { describe, it, expect } from "vitest";
import { ME_WALLET, TREASURY_WALLET } from "@/lib/traders";
import { isValidSolanaAddress } from "@/lib/solana";

// Note: TRADERS array no longer exists - all trader data is now live via the
// /api/ww/leaderboards/traders endpoint. Tests for baked data have been removed.

describe("ME_WALLET and TREASURY_WALLET", () => {
  it("ME_WALLET is a valid Solana address", () => {
    expect(isValidSolanaAddress(ME_WALLET)).toBe(true);
  });

  it("TREASURY_WALLET is a valid Solana address", () => {
    expect(isValidSolanaAddress(TREASURY_WALLET)).toBe(true);
  });
});
