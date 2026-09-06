import { describe, it, expect } from "vitest";
import { SURFACES, findSurface, buildTally } from "@/lib/surfaces";

describe("surfaces", () => {
  it("covers all three and no more", () => {
    expect(SURFACES.map((s) => s.host).sort()).toEqual([
      "wavewarz.com", "wavewarz.info", "wwtracker.vercel.app",
    ]);
  });

  it("gives each surface exactly one owner", () => {
    const owners = SURFACES.map((s) => s.owner);
    expect(new Set(owners).size).toBe(3);
    expect(owners.every((o) => o.trim().length > 0)).toBe(true);
  });

  it("resolves by slug and returns undefined for anything else", () => {
    expect(findSurface("wwtracker")?.owner).toBe("Zaal");
    expect(findSurface("nope")).toBeUndefined();
  });

  // The status column is the reason to publish this at all. A blocked item that
  // does not say what is blocking it is a status with no information in it.
  it("makes every blocked item name its blocker", () => {
    for (const s of SURFACES) {
      for (const b of s.build.filter((x) => x.stage === "blocked")) {
        expect(b.note, `${s.host}: "${b.step}" is blocked with no reason given`)
          .toBeTruthy();
      }
    }
  });

  it("counts every build item exactly once in the tally", () => {
    const tally = buildTally();
    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    expect(total).toBe(SURFACES.reduce((n, s) => n + s.build.length, 0));
  });

  it("does not claim more is done than is done", () => {
    const t = buildTally();
    // If this ever fails because "live" grew, good - update it deliberately.
    expect(t.live).toBeLessThan(t.blocked + t["not started"]);
  });
});
