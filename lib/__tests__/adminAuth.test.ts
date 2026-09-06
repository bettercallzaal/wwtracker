import { describe, it, expect } from "vitest";
import {
  checkPassword, issueToken, verifyToken, safeEqual, SESSION_TTL_MS,
} from "@/lib/adminAuth";

const PW = "correct horse battery staple";

describe("checkPassword", () => {
  it("accepts the configured password", () => {
    expect(checkPassword(PW, PW)).toBe(true);
  });

  it("rejects a wrong password", () => {
    expect(checkPassword("wrong", PW)).toBe(false);
    expect(checkPassword(PW + " ", PW)).toBe(false);
    expect(checkPassword(PW.slice(0, -1), PW)).toBe(false);
  });

  // The gate guards publishing under the brand and emailing the whole list, so
  // an unconfigured server must lock the door, not open it. This is the
  // opposite choice to lib/refresh-policy.ts and the difference is what the
  // endpoint does.
  it("fails CLOSED when ADMIN_PASSWORD is unset", () => {
    expect(checkPassword("anything", undefined)).toBe(false);
    expect(checkPassword("", undefined)).toBe(false);
    expect(checkPassword(PW, "")).toBe(false);
  });

  it("never treats the empty string as valid", () => {
    expect(checkPassword("", "")).toBe(false);
    expect(checkPassword("", PW)).toBe(false);
  });

  it("rejects non-string input rather than coercing it", () => {
    expect(checkPassword(undefined, PW)).toBe(false);
    expect(checkPassword(null, PW)).toBe(false);
    expect(checkPassword(123, PW)).toBe(false);
    expect(checkPassword({}, PW)).toBe(false);
    expect(checkPassword(true, PW)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("compares by value", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  // A raw timingSafeEqual throws on length mismatch, and the throw is itself a
  // length oracle. Hashing first keeps both buffers equal-length.
  it("handles different lengths without throwing", () => {
    expect(() => safeEqual("a", "abcdefghijklmnop")).not.toThrow();
    expect(safeEqual("a", "abcdefghijklmnop")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
});

describe("session tokens", () => {
  it("issues a token that verifies against the same secret", () => {
    expect(verifyToken(issueToken(PW), PW)).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    expect(verifyToken(issueToken("old password"), PW)).toBe(false);
  });

  // Rotating the password is the revocation mechanism: every live session dies.
  it("invalidates every existing session when the password changes", () => {
    const t = issueToken(PW);
    expect(verifyToken(t, PW)).toBe(true);
    expect(verifyToken(t, "rotated password")).toBe(false);
  });

  it("rejects an expired token", () => {
    const now = Date.now();
    const t = issueToken(PW, now);
    expect(verifyToken(t, PW, now + SESSION_TTL_MS - 1000)).toBe(true);
    expect(verifyToken(t, PW, now + SESSION_TTL_MS + 1000)).toBe(false);
  });

  it("rejects tampering with the expiry", () => {
    const t = issueToken(PW, Date.now());
    const [, nonce, mac] = t.split(".");
    const forged = `${Date.now() + 10 * SESSION_TTL_MS}.${nonce}.${mac}`;
    expect(verifyToken(forged, PW)).toBe(false);
  });

  it("rejects malformed and missing tokens", () => {
    expect(verifyToken(undefined, PW)).toBe(false);
    expect(verifyToken("", PW)).toBe(false);
    expect(verifyToken("a.b", PW)).toBe(false);
    expect(verifyToken("a.b.c.d", PW)).toBe(false);
    expect(verifyToken("not.a.token", PW)).toBe(false);
    expect(verifyToken(42, PW)).toBe(false);
  });

  it("verifies nothing when the server has no password set", () => {
    expect(verifyToken(issueToken(PW), undefined)).toBe(false);
  });

  it("issues a different token each time", () => {
    expect(issueToken(PW)).not.toBe(issueToken(PW));
  });
});
