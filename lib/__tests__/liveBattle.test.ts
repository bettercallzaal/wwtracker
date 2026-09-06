import { describe, it, expect } from "vitest";
import { pickBattle, secondsLeft, poolShare } from "@/lib/liveBattle";

const settled = (id: number) => ({
  battleId: id, live: false, winnerDecided: true, winnerSide: "artist2",
  artist1: { name: "A", poolSol: 0.1 }, artist2: { name: "B", poolSol: 0.2 },
  endsAt: "2026-09-05T04:12:25.022Z", url: `https://wavewarz.info/battles/${id}`,
});
const live = (id: number) => ({
  battleId: id, live: true, winnerDecided: false, winnerSide: null,
  artist1: { name: "L1", poolSol: 0.3 }, artist2: { name: "L2", poolSol: 0.1 },
  endsAt: "2026-09-06T05:10:00.000Z",
});

describe("pickBattle", () => {
  // THE BUG THIS EXISTS TO PREVENT. The API returns newest-first, and a battle
  // that just settled sorts above one still running. Taking [0] would show an
  // arena's visitors a finished battle while a live one played on the same
  // platform - the worst thing this widget could do on someone else's site.
  it("prefers a live battle even when a settled one is newer", () => {
    const res = { battles: [settled(300), settled(299), live(250)] };
    expect(pickBattle(res)?.id).toBe("250");
    expect(pickBattle(res)?.live).toBe(true);
  });

  // The normal state. Quick battles run about ten minutes, weeknights - most of
  // the day there is nothing live, and the widget must still look intentional.
  it("falls back to the most recent when nothing is live", () => {
    const res = { battles: [settled(300), settled(299)] };
    const b = pickBattle(res);
    expect(b?.id).toBe("300");
    expect(b?.live).toBe(false);
    expect(b?.settled).toBe(true);
  });

  it("returns null for an empty or malformed list rather than throwing", () => {
    expect(pickBattle({ battles: [] })).toBeNull();
    expect(pickBattle({})).toBeNull();
    expect(pickBattle({ battles: undefined })).toBeNull();
  });

  it("drops a row with no battle id instead of rendering a broken card", () => {
    expect(pickBattle({ battles: [{ live: true, artist1: { name: "x" } }] })).toBeNull();
  });

  it("survives missing artists and missing pools", () => {
    const b = pickBattle({ battles: [{ battleId: 7 }] });
    expect(b?.a.name).toBe("Artist 1");
    expect(b?.b.name).toBe("Artist 2");
    expect(b?.a.poolSol).toBe(0);
  });

  it("builds a url when the API omits one", () => {
    expect(pickBattle({ battles: [{ battleId: 42 }] })?.url)
      .toBe("https://wavewarz.info/battles/42");
  });

  it("only accepts a winner side it recognises", () => {
    expect(pickBattle({ battles: [{ battleId: 1, winnerSide: "artist1" }] })?.winnerSide).toBe("artist1");
    expect(pickBattle({ battles: [{ battleId: 1, winnerSide: "nonsense" }] })?.winnerSide).toBeNull();
  });
});

describe("secondsLeft", () => {
  const now = Date.parse("2026-09-06T05:00:00.000Z");
  it("counts down to the end time", () => {
    expect(secondsLeft("2026-09-06T05:10:00.000Z", now)).toBe(600);
  });
  it("floors at zero rather than going negative", () => {
    expect(secondsLeft("2026-09-06T04:50:00.000Z", now)).toBe(0);
  });
  it("returns null when there is no usable end time", () => {
    expect(secondsLeft(null, now)).toBeNull();
    expect(secondsLeft("not a date", now)).toBeNull();
  });
});

describe("poolShare", () => {
  it("splits by stake", () => {
    expect(poolShare(3, 1)).toBe(0.75);
    expect(poolShare(1, 1)).toBe(0.5);
  });
  // Before anyone trades, both sides are zero. Showing 0% for A and 0% for B
  // reads as broken; an even split reads as "nothing has happened yet".
  it("shows an even split when nothing is staked", () => {
    expect(poolShare(0, 0)).toBe(0.5);
  });
});
