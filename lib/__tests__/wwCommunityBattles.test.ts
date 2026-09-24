/**
 * A battle we launch ourselves has no names anywhere: the chain stores two
 * wallets, and wavewarz.info only indexes battles it created. Without this
 * registry the first community battle renders as "A" versus "B" forever.
 */
import { describe, expect, it } from "vitest";
import {
  describeNameSource,
  lookupCommunityBattle,
  parseCommunityRegistry,
} from "../ww/communityBattles";
import registry from "../../data/community-battles.json";

const good = {
  battles: {
    "1790211141": {
      title: "The Gauntlet",
      host: "The ZAO",
      a: { artist: "Replicant", track: "World of Disasters" },
      b: { artist: "Stilo World" },
    },
  },
};

describe("the registry", () => {
  it("reads a well-formed entry", () => {
    const { battles, problems } = parseCommunityRegistry(good);
    expect(problems).toEqual([]);
    const b = lookupCommunityBattle(battles, 1790211141);
    expect(b?.a.artist).toBe("Replicant");
    expect(b?.b.artist).toBe("Stilo World");
    expect(b?.a.track).toBe("World of Disasters");
    // An absent track stays absent rather than becoming an empty label.
    expect(b?.b.track).toBeUndefined();
    expect(b?.host).toBe("The ZAO");
  });

  it("looks up by number or string, since a battle id arrives as both", () => {
    const { battles } = parseCommunityRegistry(good);
    expect(lookupCommunityBattle(battles, "1790211141")).not.toBeNull();
    expect(lookupCommunityBattle(battles, 1790211141)).not.toBeNull();
    expect(lookupCommunityBattle(battles, 999)).toBeNull();
  });
});

describe("what it refuses, and says it refused", () => {
  /**
   * A dropped entry is a battle that renders as "A" versus "B" with nobody
   * able to say why, so every refusal is reported rather than swallowed.
   */
  it("refuses a half-filled entry: one real name beside a placeholder is worse than none", () => {
    const { battles, problems } = parseCommunityRegistry({
      battles: { "1790211141": { a: { artist: "Replicant" }, b: { artist: "" } } },
    });
    expect(battles).toEqual({});
    expect(problems).toEqual([
      { battleId: "1790211141", reason: "both sides need an artist name" },
    ]);
  });

  it("refuses both sides naming the same artist", () => {
    const { problems } = parseCommunityRegistry({
      battles: { "1790211141": { a: { artist: "Replicant" }, b: { artist: "Replicant" } } },
    });
    expect(problems[0].reason).toMatch(/same artist/);
  });

  it("refuses a key that is not a battle id", () => {
    const { problems } = parseCommunityRegistry({
      battles: { "not-an-id": { a: { artist: "A" }, b: { artist: "B" } } },
    });
    expect(problems[0].reason).toMatch(/not a battle id/);
  });

  it("keeps the good entries when one is bad, rather than failing the file", () => {
    const { battles, problems } = parseCommunityRegistry({
      battles: {
        "1790211141": { a: { artist: "Replicant" }, b: { artist: "Stilo World" } },
        "1790211142": { a: { artist: "Only One" }, b: {} },
      },
    });
    expect(Object.keys(battles)).toEqual(["1790211141"]);
    expect(problems).toHaveLength(1);
  });

  it("reports a file with no battles object rather than pretending it was empty", () => {
    expect(parseCommunityRegistry(null).problems[0].reason).toMatch(/no `battles` object/);
    expect(parseCommunityRegistry({}).problems[0].reason).toMatch(/no `battles` object/);
  });
});

describe("the shipped file parses", () => {
  /**
   * The registry is imported by the battle page at build time. A malformed
   * file would surface as missing names on a live page, which is the failure
   * this test exists to make loud and early.
   */
  it("has no problems", () => {
    expect(parseCommunityRegistry(registry).problems).toEqual([]);
  });
});

describe("two absences that are not the same", () => {
  /**
   * `sidesFor` wrapped its fetch in a catch returning null, so "the API is
   * down" and "the API has never heard of this battle" produced an identical
   * screen. For a battle of ours the second is permanent and correct and the
   * first is an outage.
   */
  it("says nothing when the names came from upstream, which is unremarkable", () => {
    expect(describeNameSource("upstream", true)).toBe("");
  });

  it("names a community battle as one, and says why upstream does not have it", () => {
    const s = describeNameSource("community", true);
    expect(s).toMatch(/community battle/i);
    expect(s).toMatch(/does not index battles it did not create/);
  });

  it("distinguishes an unnamed battle from an outage", () => {
    const unnamed = describeNameSource("none", true);
    const outage = describeNameSource("none", false);
    expect(unnamed).toMatch(/no names anywhere/);
    expect(outage).toMatch(/did not answer/);
    expect(outage).toMatch(/outage rather than a battle without names/);
    expect(unnamed).not.toBe(outage);
  });

  it("says in both cases that A and B are not artists", () => {
    for (const reachable of [true, false]) {
      expect(describeNameSource("none", reachable)).toMatch(/not artists/);
    }
  });
});
