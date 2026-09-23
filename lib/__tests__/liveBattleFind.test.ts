/**
 * A battleId is answered or refused, never ignored.
 *
 * `/api/ww/battle` took no parameters, so `?battleId=1789948124` was silently
 * discarded and the caller received whatever battle was current, with a 200
 * and nothing saying so. Measured against the running server 2026-09-22:
 * asking for 1789948124 returned 1790046123. The endpoint's job is the current
 * battle and the docs say so - but a partner who sends an id and gets someone
 * else's round has no way to tell.
 */
import { describe, expect, it } from "vitest";
import { findBattle, pickBattle, type RawBattlesResponse } from "../liveBattle";

/**
 * Upstream sends `battleId`; our shaped output renames it to `id`. The first
 * version of findBattle read `id` off the RAW row and matched nothing, and the
 * first version of this fixture used `id` too - so the test agreed with the
 * bug. The fixture now uses the field the real API sends.
 */
const res = {
  battles: [
    { battleId: "1790046123", live: false, artist1: { name: "Track One" }, artist2: { name: "Track Two" } },
    { battleId: "1789948124", live: false, artist1: { name: "Older One" }, artist2: { name: "Older Two" } },
  ],
} as unknown as RawBattlesResponse;

describe("findBattle", () => {
  it("returns the battle that was asked for, not the first one", () => {
    const found = findBattle(res, "1789948124");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("1789948124");
    // The control: the endpoint's default really would have returned the other.
    expect(pickBattle(res)!.id).toBe("1790046123");
  });

  it("is null for an id that is not in the response, rather than the nearest one", () => {
    expect(findBattle(res, "1700000000")).toBeNull();
  });

  it("matches the whole id as text, not a prefix or a padded form", () => {
    expect(findBattle(res, "01789948124")).toBeNull();
    expect(findBattle(res, "1789948124 ")).toBeNull();
  });

  it("is null when there are no battles at all", () => {
    expect(findBattle({} as RawBattlesResponse, "1789948124")).toBeNull();
    expect(findBattle({ battles: [] } as RawBattlesResponse, "1789948124")).toBeNull();
  });
});
