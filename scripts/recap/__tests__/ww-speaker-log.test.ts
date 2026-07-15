import { describe, it, expect } from "vitest";
import { run } from "@/scripts/ww-speaker-log";

describe("ww-speaker-log run()", () => {
  it("resolves an utterance's speaker from a matching caption line", () => {
    const captions = "11 Hurric4n3Ike @hurric4n3ike: yo whats good everybody";
    const utterances = JSON.stringify([
      { speaker: "speaker_0", startSec: 10, endSec: 13, text: "yo whats good everybody" },
    ]);
    const result = JSON.parse(run(captions, utterances));
    expect(result).toEqual([
      { timestampSec: 10, speaker: "Hurric4n3Ike", captionText: "yo whats good everybody" },
    ]);
  });

  it("keeps the anonymous label when no caption matches", () => {
    const captions = "";
    const utterances = JSON.stringify([
      { speaker: "speaker_2", startSec: 5, endSec: 8, text: "unmatched voice" },
    ]);
    const result = JSON.parse(run(captions, utterances));
    expect(result).toEqual([{ timestampSec: 5, speaker: "speaker_2", captionText: "unmatched voice" }]);
  });
});
