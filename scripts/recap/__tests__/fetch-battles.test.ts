import { describe, it, expect } from "vitest";
import { fetchAllBattles } from "@/scripts/ww-battles-fetch";
import type { BattleSummary } from "@/lib/wavewarzApi";

// The walk this replaced stopped at the first page that added nothing new,
// which assumes every battle we are missing is newer than every battle we
// have. Measured 2026-09-09, the 213 absent battles were spread across every
// month since launch - so the frontier could never have reached them. These
// tests pin the replacement: it walks to the end of the offsets, and the only
// thing that stops it early is the API running out of rows.

function summary(id: number): BattleSummary {
  return {
    battleId: id,
    type: "quick",
    live: false,
    winnerDecided: true,
    winnerSide: "artist1",
    artist1: {
      name: "A", wallet: "w1", musicLink: "https://audius.co/handleA/track",
      profilePictureUrl: null, twitterHandle: null, albumArtUrl: null,
      poolSol: 0.75, volumeSol: 1,
    },
    artist2: {
      name: "B", wallet: "w2", musicLink: null,
      profilePictureUrl: null, twitterHandle: null, albumArtUrl: null,
      poolSol: 0.25, volumeSol: 1,
    },
    factors: {},
    imageUrl: null,
    createdAt: "2026-07-14T12:00:00.000Z",
    endsAt: "2026-07-14T12:10:00.000Z",
    url: "https://wavewarz.info/battles/" + id,
  };
}

/** A fake API holding `total` battles, paging exactly as the real one does. */
function fakeApi(total: number, calls: number[] = []) {
  return async (limit: number, offset: number) => {
    calls.push(offset);
    return Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) =>
      summary(1000 + offset + i),
    );
  };
}

describe("fetchAllBattles", () => {
  it("keeps walking past a page that adds nothing new", async () => {
    // Every row identical to one already seen - the old frontier rule would
    // have stopped here on page two and never reached page three.
    let offsetCount = 0;
    const fetchPage = async (_l: number, offset: number) => {
      offsetCount += 1;
      // A FULL page of rows we have already seen. Only a short page is
      // allowed to end the walk - "nothing new" must not.
      return offset < 400 ? Array.from({ length: 200 }, () => summary(1)) : [];
    };
    const { battles, pagesFetched } = await fetchAllBattles(fetchPage);
    expect(offsetCount).toBeGreaterThan(2);
    expect(pagesFetched).toBeGreaterThan(2);
    expect(battles).toHaveLength(1);
  });

  it("walks every offset until a short page ends it", async () => {
    const calls: number[] = [];
    const { battles, pagesFetched } = await fetchAllBattles(fakeApi(450, calls));
    expect(calls).toEqual([0, 200, 400]);
    expect(pagesFetched).toBe(3);
    expect(battles).toHaveLength(450);
  });

  it("stops on the first page when the API is exactly one page", async () => {
    const calls: number[] = [];
    const { battles } = await fetchAllBattles(fakeApi(120, calls));
    expect(calls).toEqual([0]);
    expect(battles).toHaveLength(120);
  });

  it("fails loud rather than writing an empty file", async () => {
    await expect(fetchAllBattles(async () => [])).rejects.toThrow(/zero battles/);
  });

  it("respects maxPages as a hard stop", async () => {
    const calls: number[] = [];
    await fetchAllBattles(fakeApi(100000, calls), 3);
    expect(calls).toHaveLength(3);
  });

  it("converts a summary into the stored shape", async () => {
    const { battles } = await fetchAllBattles(fakeApi(1));
    expect(battles[0]).toEqual({
      id: "1000",
      type: "QUICK",
      date: "Jul 14, 2026",
      a: "A",
      b: "B",
      aHandle: "handleA",
      bHandle: null,
      winner: "A",
      vol: 2,
      margin: 50,
    });
  });
});
