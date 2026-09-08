import { describe, it, expect } from "vitest";
import { battlePhase, daysSinceEnd } from "@/lib/battlePhase";

// /api/ww/positions derived `running` as `!settled`. The settled flag is only
// set when somebody calls the settlement instruction, and nothing obliges anyone
// to - so an abandoned battle reported as running forever.
//
// Measured on the committed census 2026-09-08: 93 of 1,643 battles have
// winner_decided false, ALL 93 have an end_time in the past, and none is
// genuinely running. 23 carried real money. The oldest ended 2025-06-06.
//
// One of them was rendering on /live as a live battle 298 days after its window
// closed, with a countdown. The flag was not imprecise, it was never right.

const HOUR = 3600;
const NOW = 1_788_800_000;

describe("battlePhase", () => {
  it("is running while the window is open", () => {
    expect(battlePhase(false, NOW + HOUR, NOW)).toBe("running");
  });

  it("is running up to and including the end second", () => {
    expect(battlePhase(false, NOW, NOW)).toBe("running");
  });

  it("is expired once the window closes with no settlement", () => {
    // The state that did not exist before, and the one 93 battles are in.
    expect(battlePhase(false, NOW - 1, NOW)).toBe("expired");
    expect(battlePhase(false, NOW - 298 * 86400, NOW)).toBe("expired");
  });

  it("is settled whenever the flag is set, whatever the clock says", () => {
    // Settlement is the authority once it has happened. A settled battle does
    // not become un-settled because its end time is in the future.
    expect(battlePhase(true, NOW - HOUR, NOW)).toBe("settled");
    expect(battlePhase(true, NOW + HOUR, NOW)).toBe("settled");
  });

  it("never calls an ended, unsettled battle running", () => {
    // The regression that shipped. Every one of the 93 would have failed this.
    for (const daysAgo of [1, 30, 298, 450]) {
      expect(battlePhase(false, NOW - daysAgo * 86400, NOW)).not.toBe("running");
    }
  });
});

describe("daysSinceEnd", () => {
  it("counts whole days since the window closed", () => {
    expect(daysSinceEnd(NOW - 298 * 86400, NOW)).toBe(298);
    expect(daysSinceEnd(NOW - 86399, NOW)).toBe(0);
  });

  it("is negative while the window is still open", () => {
    expect(daysSinceEnd(NOW + 86400, NOW)).toBeLessThan(0);
  });
});
