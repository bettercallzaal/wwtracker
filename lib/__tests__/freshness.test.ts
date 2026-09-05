import { describe, it, expect } from "vitest";
import { DATA_AS_OF, FRESHNESS } from "@/lib/freshness";

describe("DATA_AS_OF", () => {
  it("is a valid YYYY-MM-DD ISO date string", () => {
    expect(DATA_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const d = Date.parse(`${DATA_AS_OF}T00:00:00Z`);
    expect(Number.isNaN(d)).toBe(false);
  });

  it("is not in the future", () => {
    const then = Date.parse(`${DATA_AS_OF}T00:00:00Z`);
    expect(then).toBeLessThanOrEqual(Date.now());
  });
});

describe("FRESHNESS", () => {
  it("contains at least a live-data key", () => {
    const values = Object.values(FRESHNESS);
    expect(values.some((v) => v === "live")).toBe(true);
  });

  // Three legal values, and no fourth. "live" means fetched per request,
  // "manual" means a human maintains it and no date would be honest, and
  // anything else must be a real date. A free-text value here is how a dataset
  // ends up with a reassuring label and no verifiable age.
  it("all values are a valid ISO date, 'live', or 'manual'", () => {
    for (const [key, val] of Object.entries(FRESHNESS)) {
      if (val === "live" || val === "manual") continue;
      expect(val, `FRESHNESS["${key}"] must be YYYY-MM-DD, live, or manual`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
    }
  });

  it("no dated value is in the future", () => {
    for (const [key, val] of Object.entries(FRESHNESS)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) continue;
      expect(
        Date.parse(`${val}T00:00:00Z`),
        `FRESHNESS["${key}"] is dated in the future`,
      ).toBeLessThanOrEqual(Date.now());
    }
  });
});
