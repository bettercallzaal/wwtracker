import { describe, it, expect } from "vitest";
import { parseCaptionLine, textSimilarity } from "@/scripts/recap/speaker-log";

describe("parseCaptionLine", () => {
  it("parses a Name @handle: text line", () => {
    expect(parseCaptionLine("Hurric4n3Ike @hurric4n3ike: yo whats good", 12.5)).toEqual({
      timestampSec: 12.5,
      name: "Hurric4n3Ike",
      handle: "hurric4n3ike",
      text: "yo whats good",
    });
  });

  it("parses a Name: text line with no handle", () => {
    expect(parseCaptionLine("Dutchess: this beat go hard", 40)).toEqual({
      timestampSec: 40,
      name: "Dutchess",
      handle: null,
      text: "this beat go hard",
    });
  });

  it("returns null for blank lines", () => {
    expect(parseCaptionLine("", 0)).toBeNull();
    expect(parseCaptionLine("   ", 0)).toBeNull();
  });

  it("returns null for a line with no name/text separator", () => {
    expect(parseCaptionLine("just some noise with no colon", 5)).toBeNull();
  });

  it("returns null when the text portion is empty", () => {
    expect(parseCaptionLine("Kata @kata:", 8)).toBeNull();
    expect(parseCaptionLine("Kata:", 8)).toBeNull();
  });

  it("handles handles with digits/underscores", () => {
    expect(parseCaptionLine("Candy @candy_toy_box99: lets go", 1)).toEqual({
      timestampSec: 1,
      name: "Candy",
      handle: "candy_toy_box99",
      text: "lets go",
    });
  });
});

describe("textSimilarity", () => {
  it("is 1 for identical text", () => {
    expect(textSimilarity("this beat go hard", "this beat go hard")).toBe(1);
  });

  it("is 0 for completely unrelated text", () => {
    expect(textSimilarity("wavewarz music battle", "solana token price today")).toBe(0);
  });

  it("is between 0 and 1 for partial overlap", () => {
    const score = textSimilarity("this beat is fire ngl", "this beat go hard fr");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it("ignores case and punctuation", () => {
    expect(textSimilarity("This Beat Go Hard!", "this beat go hard")).toBe(1);
  });

  it("is 0 when either text has no significant (non-stopword) tokens", () => {
    expect(textSimilarity("the a an", "this beat go hard")).toBe(0);
    expect(textSimilarity("this beat go hard", "")).toBe(0);
  });
});
