import { describe, it, expect } from "vitest";
import {
  displayDate,
  handleFromMusicLink,
  marginPct,
  mergeFromApi,
} from "@/scripts/recap/battles-from-api";
import type { StoredBattle } from "@/scripts/recap/types";

function row(over: Partial<StoredBattle> = {}): StoredBattle {
  return {
    id: "1", type: "QUICK", date: "Aug 25, 2026", a: "A", b: "B",
    aHandle: "ha", bHandle: "hb", winner: "A", vol: 1, margin: 20, ...over,
  };
}

describe("field mapping", () => {
  it("reads the Audius handle out of a track link", () => {
    expect(handleFromMusicLink("https://audius.co/Hondro/i-am-hondro")).toBe("Hondro");
    expect(handleFromMusicLink("https://audius.co/Kata7yst/say-eltio")).toBe("Kata7yst");
  });

  it("returns null rather than guessing at a link it does not recognise", () => {
    expect(handleFromMusicLink(null)).toBeNull();
    expect(handleFromMusicLink("")).toBeNull();
    expect(handleFromMusicLink("https://hyperfollow.com/whatever")).toBeNull();
  });

  it("formats the date in UTC, so the day cannot drift with the runner", () => {
    expect(displayDate("2026-08-25T03:48:27.247448+00:00")).toBe("Aug 25, 2026");
    // 23:30 UTC is still the 25th. Local-time formatting made 12 battles land
    // on the wrong day in the scraped file.
    expect(displayDate("2026-08-25T23:30:00.000Z")).toBe("Aug 25, 2026");
  });

  it("computes the margin the way the old feed reported it", () => {
    // Battle 1787629692: pools 0.0788 / 0.1773, and the feed said 38.
    expect(marginPct(0.0788, 0.1773)).toBe(38);
    expect(marginPct(0.5, 0.5)).toBe(0);
  });

  it("has no margin on a battle nobody traded", () => {
    // 0 would render as a dead heat, which is a different claim from "no data".
    expect(marginPct(0, 0)).toBeNull();
  });
});

describe("mergeFromApi", () => {
  it("lets the API correct a value we already hold", () => {
    const { merged } = mergeFromApi([row({ vol: 0.55 })], [row({ vol: 0.64 })]);
    expect(merged[0].vol).toBe(0.64);
  });

  it("never lets an API null delete a winner we already have", () => {
    // The API returns no winnerSide for 239 battles, 216 of which we hold a
    // winner for. A refresh that dropped those would destroy the only record.
    const { merged, preserved } = mergeFromApi(
      [row({ winner: "A" })],
      [row({ winner: null })],
    );
    expect(merged[0].winner).toBe("A");
    expect(preserved).toEqual([{ id: "1", field: "winner" }]);
  });

  it("takes a winner the API does state, over ours", () => {
    const { merged } = mergeFromApi([row({ winner: "A" })], [row({ winner: "B" })]);
    expect(merged[0].winner).toBe("B");
  });

  it("keeps handles and margin against a null the same way", () => {
    const { merged } = mergeFromApi(
      [row({ aHandle: "ha", bHandle: "hb", margin: 20 })],
      [row({ aHandle: null, bHandle: null, margin: null })],
    );
    expect(merged[0]).toMatchObject({ aHandle: "ha", bHandle: "hb", margin: 20 });
  });

  it("holds on to battles the API does not list", () => {
    // Two MAIN events are in the file and not in the API. A rebuild that only
    // wrote what the API returned would silently drop them.
    const { merged, keptOutsideApi } = mergeFromApi(
      [row({ id: "999" }), row({ id: "1" })],
      [row({ id: "1" })],
    );
    expect(merged).toHaveLength(2);
    expect(keptOutsideApi.map((b) => b.id)).toEqual(["999"]);
  });

  it("adds what is new and sorts newest first", () => {
    const { merged, added } = mergeFromApi(
      [row({ id: "100" })],
      [row({ id: "100" }), row({ id: "300" }), row({ id: "200" })],
    );
    expect(added.map((b) => b.id)).toEqual(["300", "200"]);
    expect(merged.map((b) => b.id)).toEqual(["300", "200", "100"]);
  });
});
