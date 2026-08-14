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

  it("all snapshot values are valid ISO dates or 'live'", () => {
    for (const [key, val] of Object.entries(FRESHNESS)) {
      if (val === "live") continue;
      expect(val, `FRESHNESS["${key}"] must be YYYY-MM-DD`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
