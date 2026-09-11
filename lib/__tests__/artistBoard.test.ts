import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { artistTiles } from "@/lib/artistBoard";
import { LEADERBOARD, LEADERBOARD_AS_OF } from "@/lib/leaderboard";

// The /artist/[handle] tiles showed the 2026-06-15 snapshot, unlabelled, both
// while the live board loaded and whenever it failed or missed the artist.

const root = fileURLToPath(new URL("../../", import.meta.url));
const lb = LEADERBOARD[0];
const live = { rank: 3, wins: 5, losses: 1, winRate: 83.3, totalVolumeSol: "41.5", totalEarningsSol: "0.912" };

describe("artistTiles", () => {
  it("shows no snapshot figure while the live board is loading", () => {
    const t = artistTiles({ kind: "loading" }, lb);
    expect([t.rec, t.win, t.vol, t.earn]).toEqual(["-", "-", "-", "-"]);
    expect(t.note).toBeNull();
    // The snapshot's own record must not appear anywhere in the loading state.
    expect(JSON.stringify(t)).not.toContain(lb.rec);
  });

  it("shows live figures with no note when the board answers", () => {
    const t = artistTiles({ kind: "live", row: live }, lb);
    expect(t.rec).toBe("5W-1L");
    expect(t.win).toBe("83%");
    expect(t.rank).toBe("#3");
    expect(t.note).toBeNull();
  });

  it("labels the snapshot with its date and the reason when it is the fallback", () => {
    const t = artistTiles({ kind: "snapshot", reason: "the live leaderboard did not answer" }, lb);
    expect(t.rec).toBe(lb.rec);
    expect(t.rank).toContain(LEADERBOARD_AS_OF);
    expect(t.note).toContain(LEADERBOARD_AS_OF);
    expect(t.note).toContain("the live leaderboard did not answer");
  });
});

describe("the artist page renders through it", () => {
  const page = readFileSync(`${root}app/artist/[handle]/page.tsx`, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

  it("routes the tiles through artistTiles and shows its note", () => {
    expect(page).toContain("artistTiles(board, lb)");
    expect(page).toContain("tiles.note");
  });

  it("never renders a snapshot stat directly", () => {
    // The shape that shipped: `liveArtist ? live : lb.rec` - the snapshot as a
    // silent fallback. Any lb.<stat> in the page is that shape coming back.
    expect(page).not.toMatch(/\blb\.(rec|win|vol|earn|rank)\b/);
  });
});
