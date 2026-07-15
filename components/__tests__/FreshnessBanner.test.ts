import { describe, it, expect } from "vitest";
import { daysSince } from "@/components/FreshnessBanner";

const DAY_MS = 86_400_000;

describe("daysSince", () => {
  it("returns 0 for the same day", () => {
    const now = Date.parse("2026-06-16T12:00:00Z");
    expect(daysSince("2026-06-16", now)).toBe(0);
  });

  it("counts whole days elapsed", () => {
    const now = Date.parse("2026-06-18T00:00:00Z");
    expect(daysSince("2026-06-16", now)).toBe(2);
  });

  it("floors partial days rather than rounding up", () => {
    const now = Date.parse("2026-06-18T23:59:00Z");
    expect(daysSince("2026-06-16", now)).toBe(2);
  });

  it("returns 0 (not NaN) for an unparseable date string", () => {
    expect(daysSince("not-a-date", Date.now())).toBe(0);
  });

  it("defaults now to the real current time when not supplied", () => {
    const iso = new Date(Date.now() - 3 * DAY_MS).toISOString().slice(0, 10);
    expect(daysSince(iso)).toBeGreaterThanOrEqual(2);
  });
});
