import { describe, it, expect } from "vitest";
import { usd } from "@/lib/price";
import { isValidSolanaAddress } from "@/lib/solana";

describe("usd", () => {
  it("formats a SOL amount as approx USD", () => {
    expect(usd(1)).toBe("≈ $70");
  });
  it("uses the absolute value for negatives", () => {
    expect(usd(-1)).toBe("≈ $70");
  });
  it("respects decimal places", () => {
    expect(usd(1, 2)).toBe("≈ $70.33");
  });
});

describe("isValidSolanaAddress", () => {
  const good = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
  it("accepts a valid base58 address", () => {
    expect(isValidSolanaAddress(good)).toBe(true);
  });
  it("rejects strings that are too short", () => {
    expect(isValidSolanaAddress("abc")).toBe(false);
  });
  it("rejects non-strings", () => {
    expect(isValidSolanaAddress(123)).toBe(false);
    expect(isValidSolanaAddress(null)).toBe(false);
    expect(isValidSolanaAddress(undefined)).toBe(false);
  });
  it("rejects base58-invalid characters", () => {
    expect(isValidSolanaAddress("0".repeat(40))).toBe(false);
  });
});
