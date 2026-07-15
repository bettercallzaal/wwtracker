import { describe, it, expect } from "vitest";
import {
  parseCaptionLine,
  textSimilarity,
  resolveSpeakerNames,
  type CaptionEvent,
  type DiarizedUtterance,
} from "@/scripts/recap/speaker-log";

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

describe("resolveSpeakerNames", () => {
  it("matches a speaker to a name via overlapping time + text", () => {
    const utterances: DiarizedUtterance[] = [
      { speaker: "speaker_0", startSec: 10, endSec: 13, text: "yo whats good everybody" },
    ];
    const captions: CaptionEvent[] = [
      { timestampSec: 11, name: "Hurric4n3Ike", handle: "hurric4n3ike", text: "yo whats good everybody" },
    ];
    const result = resolveSpeakerNames(utterances, captions);
    expect(result).toEqual([
      { speaker: "speaker_0", name: "Hurric4n3Ike", handle: "hurric4n3ike", confidence: 1, matchedCaptionCount: 1 },
    ]);
  });

  it("omits a speaker with no caption above the similarity threshold", () => {
    const utterances: DiarizedUtterance[] = [
      { speaker: "speaker_1", startSec: 10, endSec: 13, text: "completely unrelated words here" },
    ];
    const captions: CaptionEvent[] = [
      { timestampSec: 11, name: "Dutchess", handle: null, text: "totally different topic entirely" },
    ];
    expect(resolveSpeakerNames(utterances, captions)).toEqual([]);
  });

  it("ignores captions outside the time window", () => {
    const utterances: DiarizedUtterance[] = [
      { speaker: "speaker_0", startSec: 100, endSec: 103, text: "this beat go hard" },
    ];
    const captions: CaptionEvent[] = [
      // Same text, but 30s away - outside default 3s window, must not match.
      { timestampSec: 10, name: "Kata", handle: "kata", text: "this beat go hard" },
    ];
    expect(resolveSpeakerNames(utterances, captions)).toEqual([]);
  });

  it("majority-votes when a speaker's utterances point to conflicting names", () => {
    const utterances: DiarizedUtterance[] = [
      { speaker: "speaker_2", startSec: 10, endSec: 12, text: "this beat go hard fr" },
      { speaker: "speaker_2", startSec: 20, endSec: 22, text: "this beat go hard fr" },
      { speaker: "speaker_2", startSec: 30, endSec: 32, text: "wrong match text here" },
    ];
    const captions: CaptionEvent[] = [
      { timestampSec: 11, name: "GodclouD", handle: "therealgodcloud", text: "this beat go hard fr" },
      { timestampSec: 21, name: "GodclouD", handle: "therealgodcloud", text: "this beat go hard fr" },
      { timestampSec: 31, name: "Candy", handle: "candytoybox", text: "wrong match text here" },
    ];
    const result = resolveSpeakerNames(utterances, captions);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("GodclouD");
    expect(result[0].matchedCaptionCount).toBe(3);
    expect(result[0].confidence).toBeGreaterThan(0.5);
  });

  it("resolves multiple distinct speakers independently, sorted by speaker id", () => {
    const utterances: DiarizedUtterance[] = [
      { speaker: "speaker_1", startSec: 20, endSec: 22, text: "this beat go hard fr" },
      { speaker: "speaker_0", startSec: 10, endSec: 12, text: "yo whats good everybody" },
    ];
    const captions: CaptionEvent[] = [
      { timestampSec: 11, name: "Hurric4n3Ike", handle: "hurric4n3ike", text: "yo whats good everybody" },
      { timestampSec: 21, name: "Dutchess", handle: null, text: "this beat go hard fr" },
    ];
    const result = resolveSpeakerNames(utterances, captions);
    expect(result.map((r) => r.speaker)).toEqual(["speaker_0", "speaker_1"]);
    expect(result[0].name).toBe("Hurric4n3Ike");
    expect(result[1].name).toBe("Dutchess");
    expect(result[1].handle).toBeNull();
  });

  it("respects custom windowSec and minSimilarity options", () => {
    const utterances: DiarizedUtterance[] = [
      { speaker: "speaker_0", startSec: 100, endSec: 103, text: "this beat go hard" },
    ];
    const captions: CaptionEvent[] = [
      { timestampSec: 10, name: "Kata", handle: "kata", text: "this beat go hard" },
    ];
    // With a wide enough window the far-away caption now qualifies.
    const result = resolveSpeakerNames(utterances, captions, { windowSec: 200 });
    expect(result).toEqual([
      { speaker: "speaker_0", name: "Kata", handle: "kata", confidence: 1, matchedCaptionCount: 1 },
    ]);
  });
});
