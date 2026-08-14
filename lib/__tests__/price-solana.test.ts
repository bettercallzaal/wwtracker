import { describe, it, expect } from "vitest";
import { usd, SOL_USD } from "@/lib/price";
import { isValidSolanaAddress } from "@/lib/solana";

describe("usd", () => {
  // Derived from SOL_USD rather than hardcoded. These previously asserted "≈ $70"
  // and broke the moment the constant moved to 75.02 - a test that has to be
  // edited every time a price updates is testing the price, not the formatter.
  // What matters here is the formatting behaviour: the prefix, the rounding, the
  // decimal places, and that negatives use the absolute value.
  it("formats a SOL amount as approx USD", () => {
    expect(usd(1)).toBe(`≈ $${Math.round(SOL_USD)}`);
  });
  it("uses the absolute value for negatives", () => {
    expect(usd(-1)).toBe(usd(1));
  });
  it("respects decimal places", () => {
    expect(usd(1, 2)).toBe(`≈ $${SOL_USD.toFixed(2)}`);
  });
  it("scales with the amount", () => {
    expect(usd(2)).toBe(`≈ $${Math.round(SOL_USD * 2)}`);
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
