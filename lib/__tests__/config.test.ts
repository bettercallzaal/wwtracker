import { describe, it, expect } from "vitest";
import { PROGRAM_ID, TREASURY_WALLET, TRACKED_TRADER_WALLET, FLOOR_SOL } from "@/lib/config";
import { isValidSolanaAddress } from "@/lib/solana";

describe("config", () => {
  it("exports valid base58 Solana addresses", () => {
    expect(isValidSolanaAddress(PROGRAM_ID)).toBe(true);
    expect(isValidSolanaAddress(TREASURY_WALLET)).toBe(true);
    expect(isValidSolanaAddress(TRACKED_TRADER_WALLET)).toBe(true);
  });

  it("operating floor is 3.5 SOL", () => {
    expect(FLOOR_SOL).toBe(3.5);
  });
});
