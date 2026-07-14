import { describe, it, expect } from "vitest";
import { toIsoDate } from "@/scripts/recap/date";

describe("toIsoDate", () => {
  it("converts a display date to ISO", () => {
    expect(toIsoDate("Jun 15, 2026")).toBe("2026-06-15");
  });
  it("pads single-digit days", () => {
    expect(toIsoDate("Jul 4, 2026")).toBe("2026-07-04");
  });
  it("returns null for an unparseable string", () => {
    expect(toIsoDate("not a date")).toBeNull();
  });
  it("returns null for an already-ISO string", () => {
    expect(toIsoDate("2026-06-15")).toBeNull();
  });
});
