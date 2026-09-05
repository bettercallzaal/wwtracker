import { describe, it, expect } from "vitest";
import { audiusHandleFromLink } from "@/lib/songs";

// The per-artist song list joins on the Audius permalink's handle segment
// rather than on the API's display name, because the two are frequently
// different ("GodclouD" vs "therealgodcloud"). These cover that parse, which is
// the single point where a bad result would silently empty an artist's page.
describe("audiusHandleFromLink", () => {
  it("pulls the handle out of an Audius permalink", () => {
    expect(audiusHandleFromLink("https://audius.co/GodclouD/fuck-yo-feelingz")).toBe("GodclouD");
  });

  it("tolerates the stray leading whitespace seen in real admin-pasted links", () => {
    expect(audiusHandleFromLink("  https://audius.co/Kata7yst/say-eltio ")).toBe("Kata7yst");
  });

  it("decodes a percent-encoded handle", () => {
    expect(audiusHandleFromLink("https://audius.co/Goose%20P%C3%A4rk/track")).toBe("Goose Pärk");
  });

  it("returns null for a non-Audius host", () => {
    expect(audiusHandleFromLink("https://hyperfollow.com/someartist/song")).toBeNull();
  });

  it("returns null for empty, missing and malformed input", () => {
    expect(audiusHandleFromLink("")).toBeNull();
    expect(audiusHandleFromLink(null)).toBeNull();
    expect(audiusHandleFromLink(undefined)).toBeNull();
    expect(audiusHandleFromLink("not a url")).toBeNull();
  });

  it("returns null when the permalink has no handle segment", () => {
    expect(audiusHandleFromLink("https://audius.co/")).toBeNull();
  });
});
