import { describe, it, expect } from "vitest";
import { parseEntry, parseMusicLink, rosterFromEntries, shortWallet } from "@/lib/artistIdentity";

// Real payloads, taken from wavewarz.info/api/public/battles on 2026-09-06.
const ZAAL = {
  name: "WaveWarZ, the electric vibez",
  wallet: "ASpsqT7qKbHF7VhsBPYGRk95vNyAgPuhTBoh2o7ptRLb",
  musicLink: "https://audius.co/bettercallzaal/wavewarz-the-electric-vibez",
};
const GODCLOUD = {
  name: "Sun",
  wallet: "8znqC914ucFCgzunJkbqyW6BjtDtuaLtLzkDHWhYHSMq",
  musicLink: "https://audius.co/GodclouD/sun",
};

describe("parseMusicLink", () => {
  it("splits an Audius link into handle and track slug", () => {
    expect(parseMusicLink("https://audius.co/GodclouD/sun"))
      .toEqual({ handle: "GodclouD", slug: "sun" });
  });
  it("ignores links that are not Audius", () => {
    expect(parseMusicLink("https://spotify.com/x/y")).toBeNull();
    expect(parseMusicLink("https://audius.co/onlyhandle")).toBeNull();
  });
  it("ignores non-strings", () => {
    expect(parseMusicLink(null)).toBeNull();
    expect(parseMusicLink(undefined)).toBeNull();
    expect(parseMusicLink(42)).toBeNull();
  });
});

describe("parseEntry", () => {
  // THE WHOLE POINT. The API's `name` is the track, not the artist. Measured:
  // 174 distinct values in that field against 34 distinct wallets over 120
  // battles. Rendering it as an artist prints song titles where names belong.
  it("treats `name` as the track and the handle as the artist", () => {
    const e = parseEntry(ZAAL)!;
    expect(e.track.title).toBe("WaveWarZ, the electric vibez");
    expect(e.artist.handle).toBe("bettercallzaal");
    expect(e.artist.displayName).toBe("bettercallzaal");
    expect(e.artist.displayName).not.toBe(e.track.title);
  });

  it("uses the wallet as the canonical id", () => {
    expect(parseEntry(GODCLOUD)!.artist.wallet)
      .toBe("8znqC914ucFCgzunJkbqyW6BjtDtuaLtLzkDHWhYHSMq");
  });

  it("never falls back to the track title for a display name", () => {
    const e = parseEntry({ name: "Some Song", wallet: "So11111111111111111111111111111111111111112" })!;
    expect(e.artist.displayName).toBe("So11...1112");
    expect(e.artist.displayName).not.toContain("Some Song");
  });

  it("falls back to the X handle when there is no Audius link", () => {
    const e = parseEntry({ name: "T", wallet: "W1234567890abcdef", twitterHandle: "kata7yst" })!;
    expect(e.artist.displayName).toBe("kata7yst");
  });

  // No wallet means no identity. Inventing one from a track title is how two
  // different artists get merged into one record.
  it("returns null without a wallet rather than guessing", () => {
    expect(parseEntry({ name: "Song", musicLink: "https://audius.co/x/y" })).toBeNull();
    expect(parseEntry({ wallet: "   " })).toBeNull();
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry("nope")).toBeNull();
  });

  it("handles a missing title without dropping the entry", () => {
    expect(parseEntry({ wallet: "W1234567890abcdef" })!.track.title).toBe("Untitled");
  });
});

describe("rosterFromEntries", () => {
  it("groups by wallet, so one artist with many tracks is one artist", () => {
    const entries = [
      parseEntry(GODCLOUD)!,
      parseEntry({ ...GODCLOUD, name: "Another", musicLink: "https://audius.co/GodclouD/another" })!,
      parseEntry(ZAAL)!,
    ];
    const roster = rosterFromEntries(entries);
    expect(roster.size).toBe(2);
    expect(roster.get(GODCLOUD.wallet)!.tracks).toBe(2);
    expect(roster.get(GODCLOUD.wallet)!.handle).toBe("GodclouD");
  });

  // Grouping by the name field instead would have produced one "artist" per
  // song - 174 of them across the sample instead of 34.
  it("does not create a separate artist per track", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      parseEntry({ ...GODCLOUD, name: `Track ${i}`, musicLink: `https://audius.co/GodclouD/t${i}` })!);
    expect(rosterFromEntries(entries).size).toBe(1);
  });

  it("keeps a handle found on a later entry", () => {
    const bare = parseEntry({ name: "x", wallet: GODCLOUD.wallet })!;
    const rich = parseEntry(GODCLOUD)!;
    expect(rosterFromEntries([bare, rich]).get(GODCLOUD.wallet)!.handle).toBe("GodclouD");
  });
});

describe("shortWallet", () => {
  it("shortens long addresses and leaves short ones alone", () => {
    expect(shortWallet("So11111111111111111111111111111111111111112")).toBe("So11...1112");
    expect(shortWallet("abc")).toBe("abc");
  });
});
