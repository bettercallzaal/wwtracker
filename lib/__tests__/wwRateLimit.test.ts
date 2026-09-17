/**
 * The relay budget. Time is injected rather than mocked, so these are ordinary
 * deterministic tests and not clock-dependent flakes.
 */
import { describe, expect, it } from "vitest";
import {
  GLOBAL_PER_MINUTE,
  PER_CALLER_PER_MINUTE,
  RelayBudget,
  callerKey,
} from "../ww/rateLimit";

describe("per-caller limit", () => {
  it("allows exactly the limit, then denies", () => {
    const b = new RelayBudget(3, 100);
    const t = 1_000_000;
    expect([0, 1, 2].map((i) => b.take("a", t + i).allowed)).toEqual([true, true, true]);
    const denied = b.take("a", t + 3);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toMatch(/over 3 requests a minute/);
    expect(denied.retryAfter).toBeGreaterThan(0);
    expect(denied.retryAfter).toBeLessThanOrEqual(60);
  });

  it("does not charge one caller for another's use", () => {
    const b = new RelayBudget(2, 100);
    const t = 1_000_000;
    b.take("a", t);
    b.take("a", t);
    expect(b.take("a", t).allowed).toBe(false);
    expect(b.take("b", t).allowed).toBe(true);
  });

  it("lets a caller back in on the next window", () => {
    const b = new RelayBudget(1, 100);
    const t = 1_000_000;
    expect(b.take("a", t).allowed).toBe(true);
    expect(b.take("a", t + 59_000).allowed).toBe(false);
    expect(b.take("a", t + 60_001).allowed).toBe(true);
  });
});

describe("the global ceiling, which is the one that protects the key", () => {
  /**
   * The point of the whole module. Per-IP limiting does nothing against a
   * hundred IPs, and a hundred IPs is what would exhaust the RPC key and take
   * /live down. If this test were removed, the per-caller tests above would all
   * still pass while the thing being protected was unprotected.
   */
  it("stops a flood of distinct callers who are each under their own limit", () => {
    const b = new RelayBudget(5, 10);
    const t = 1_000_000;
    let allowed = 0;
    for (let i = 0; i < 200; i++) if (b.take(`caller-${i}`, t).allowed) allowed++;
    expect(allowed).toBe(10);
    expect(b.snapshot(t).globalUsed).toBe(10);
  });

  it("is checked before the per-caller bucket, so a new caller cannot take the last of a spent budget", () => {
    const b = new RelayBudget(50, 2);
    const t = 1_000_000;
    b.take("a", t);
    b.take("a", t);
    const fresh = b.take("brand-new", t);
    expect(fresh.allowed).toBe(false);
    expect(fresh.reason).toMatch(/global budget/);
  });

  it("refills on the next window", () => {
    const b = new RelayBudget(50, 2);
    const t = 1_000_000;
    b.take("a", t);
    b.take("a", t);
    expect(b.take("a", t + 1).allowed).toBe(false);
    expect(b.take("a", t + 60_001).allowed).toBe(true);
  });

  it("never lets a denied request consume budget", () => {
    const b = new RelayBudget(1, 100);
    const t = 1_000_000;
    b.take("a", t);
    for (let i = 0; i < 20; i++) b.take("a", t);
    expect(b.snapshot(t).globalUsed).toBe(1);
  });
});

describe("caller tracking cannot grow without bound", () => {
  it("keeps the map bounded under a flood of distinct keys", () => {
    const b = new RelayBudget(5, 1_000_000);
    const t = 1_000_000;
    for (let i = 0; i < 12_000; i++) b.take(`c${i}`, t);
    expect(b.snapshot(t).trackedCallers).toBeLessThanOrEqual(5_001);
  });
});

describe("callerKey", () => {
  it("takes the first hop of x-forwarded-for", () => {
    expect(callerKey(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then to a SHARED key", () => {
    expect(callerKey(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    // Shared, not unique-per-request: a per-request identity is no limit at all,
    // so unknown callers must contend with each other.
    expect(callerKey(new Headers())).toBe("unknown");
    expect(callerKey(new Headers())).toBe(callerKey(new Headers()));
  });
});

describe("the shipped defaults are sane", () => {
  it("is generous for a person and useless for a loop", () => {
    expect(PER_CALLER_PER_MINUTE).toBeGreaterThanOrEqual(10);
    expect(PER_CALLER_PER_MINUTE).toBeLessThanOrEqual(60);
    expect(GLOBAL_PER_MINUTE).toBeGreaterThan(PER_CALLER_PER_MINUTE);
    // Well under what a keyed endpoint serves, so /live keeps its headroom.
    expect(GLOBAL_PER_MINUTE).toBeLessThanOrEqual(300);
  });
});
