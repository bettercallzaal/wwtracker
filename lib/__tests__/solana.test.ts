import { describe, it, expect } from "vitest";
import { isValidSolanaAddress } from "@/lib/solana";

describe("isValidSolanaAddress", () => {
  it("accepts the known WaveWarZ program and wallet addresses", () => {
    expect(isValidSolanaAddress("9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo")).toBe(true);
    expect(isValidSolanaAddress("FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37")).toBe(true);
    expect(isValidSolanaAddress("4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk")).toBe(true);
  });

  it("rejects non-string inputs", () => {
    expect(isValidSolanaAddress(null)).toBe(false);
    expect(isValidSolanaAddress(undefined)).toBe(false);
    expect(isValidSolanaAddress(42)).toBe(false);
    expect(isValidSolanaAddress({})).toBe(false);
    expect(isValidSolanaAddress([])).toBe(false);
  });

  it("rejects strings that are too short or too long", () => {
    expect(isValidSolanaAddress("")).toBe(false);
    expect(isValidSolanaAddress("abc")).toBe(false);
    expect(isValidSolanaAddress("A".repeat(31))).toBe(false);
    expect(isValidSolanaAddress("A".repeat(45))).toBe(false);
  });

  it("rejects addresses containing invalid Base58 characters (0, O, I, l)", () => {
    const base = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
    expect(isValidSolanaAddress("0" + base.slice(1))).toBe(false);
    expect(isValidSolanaAddress("O" + base.slice(1))).toBe(false);
    expect(isValidSolanaAddress("I" + base.slice(1))).toBe(false);
    expect(isValidSolanaAddress("l" + base.slice(1))).toBe(false);
  });

  it("rejects addresses with spaces or punctuation", () => {
    expect(isValidSolanaAddress("9TUfEHvk5fN5vogtQyrefgNqzKy2 Bqb4nWVhSFUg2fYo")).toBe(false);
    expect(isValidSolanaAddress("9TUfEHvk5fN5vogtQyrefgNqzKy2.Bqb4nWVhSFUg2fYo")).toBe(false);
  });
});
