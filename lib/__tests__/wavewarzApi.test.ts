import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getPublicStats,
  getPublicBattles,
  getPublicBattleById,
  getPublicEvents,
  getArtistLeaderboard,
  getTraderLeaderboard,
  getSongLeaderboard,
  pollWinnerOf,
  solNum,
} from "@/lib/wavewarzApi";

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getPublicStats", () => {
  it("fetches the stats endpoint and returns the parsed body", async () => {
    const fn = mockFetchOnce({ solPriceUsd: 78.21 });
    const result = await getPublicStats();
    expect(fn).toHaveBeenCalledWith("https://wavewarz.info/api/public/stats");
    expect(result).toEqual({ solPriceUsd: 78.21 });
  });

  it("throws with status info on a non-ok response", async () => {
    mockFetchOnce({}, false, 503);
    await expect(getPublicStats()).rejects.toThrow(/503/);
  });
});

describe("getPublicBattles", () => {
  it("builds the URL with no params when none given", async () => {
    const fn = mockFetchOnce({ battles: [] });
    await getPublicBattles();
    expect(fn).toHaveBeenCalledWith("https://wavewarz.info/api/public/battles");
  });

  it("builds the query string from provided params", async () => {
    const fn = mockFetchOnce({ battles: [] });
    await getPublicBattles({ type: "quick", live: true, limit: 5, offset: 10 });
    const calledUrl = fn.mock.calls[0][0] as string;
    const params = new URL(calledUrl).searchParams;
    expect(params.get("type")).toBe("quick");
    expect(params.get("live")).toBe("true");
    expect(params.get("limit")).toBe("5");
    expect(params.get("offset")).toBe("10");
  });
});

describe("getPublicBattleById", () => {
  it("fetches the battle-specific path", async () => {
    const fn = mockFetchOnce({ battleId: 1784682904 });
    await getPublicBattleById(1784682904);
    expect(fn).toHaveBeenCalledWith("https://wavewarz.info/api/public/battles/1784682904");
  });
});

describe("getPublicEvents", () => {
  it("builds the query string from provided params", async () => {
    const fn = mockFetchOnce({ events: [] });
    await getPublicEvents({ subtype: "charity", limit: 1 });
    const params = new URL(fn.mock.calls[0][0] as string).searchParams;
    expect(params.get("subtype")).toBe("charity");
    expect(params.get("limit")).toBe("1");
  });
});

describe("leaderboard fetchers", () => {
  // These endpoints return a WRAPPED object, not a bare array. The mocks below
  // deliberately mirror the real shape - the earlier mocks returned `[]`, which
  // made the tests pass against a shape the API never sends.
  it("getArtistLeaderboard defaults limit to 100 and unwraps `artists`", async () => {
    const fn = mockFetchOnce({ updatedAt: "x", count: 1, artists: [{ wallet: "w", name: "Geek Myth" }] });
    const result = await getArtistLeaderboard();
    expect(fn).toHaveBeenCalledWith("https://wavewarz.info/api/public/leaderboards/artists?limit=100");
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name).toBe("Geek Myth");
  });

  it("getTraderLeaderboard respects a custom limit and unwraps `traders`", async () => {
    const fn = mockFetchOnce({ updatedAt: "x", solPriceUsd: 76, count: 1, traders: [{ wallet: "w" }] });
    const result = await getTraderLeaderboard(10);
    expect(fn).toHaveBeenCalledWith("https://wavewarz.info/api/public/leaderboards/traders?limit=10");
    expect(result).toHaveLength(1);
  });

  it("getSongLeaderboard builds sort + limit params and unwraps `songs`", async () => {
    const fn = mockFetchOnce({ updatedAt: "x", count: 1, songs: [{ songTitle: "Ashes" }] });
    const result = await getSongLeaderboard({ sort: "battles", limit: 10 });
    const params = new URL(fn.mock.calls[0][0] as string).searchParams;
    expect(params.get("sort")).toBe("battles");
    expect(params.get("limit")).toBe("10");
    expect(result[0].songTitle).toBe("Ashes");
  });

  it("returns an empty array rather than throwing when the wrapper key is absent", async () => {
    mockFetchOnce({ updatedAt: "x", count: 0 });
    await expect(getArtistLeaderboard()).resolves.toEqual([]);
  });
});

describe("solNum", () => {
  // The artists endpoint sends totalVolumeSol as "300.7357", and every *Usd
  // field on every endpoint is a formatted string like "$22,879.97".
  it("passes numbers through", () => {
    expect(solNum(300.7357)).toBe(300.7357);
  });

  it("parses numeric strings", () => {
    expect(solNum("300.7357")).toBe(300.7357);
  });

  it("strips currency formatting", () => {
    expect(solNum("$22,879.97")).toBe(22879.97);
  });

  it("returns null - never 0 - for missing or unparseable values", () => {
    expect(solNum(null)).toBeNull();
    expect(solNum(undefined)).toBeNull();
    expect(solNum("")).toBeNull();
    expect(solNum("n/a")).toBeNull();
    expect(solNum(NaN)).toBeNull();
  });
});

// The API returns a different `factors` shape per battle type - verified live
// 2026-08-12. Quick/community carry pollWinner + djWavy*, Main Events carry
// humanJudgeWinner/xPollWinner/solVoteWinner. Reading only the quick-battle key
// silently dropped every Main Event from the /edge poll stat.
describe("pollWinnerOf", () => {
  it("reads pollWinner on a quick battle", () => {
    expect(pollWinnerOf({ pollWinner: "artist1", djWavyWinner: "artist2" })).toBe("artist1");
  });

  it("reads xPollWinner on a main event", () => {
    expect(
      pollWinnerOf({ humanJudgeWinner: "artist1", xPollWinner: "artist2", solVoteWinner: "artist2" }),
    ).toBe("artist2");
  });

  it("returns null - not a default side - when no poll verdict exists", () => {
    expect(pollWinnerOf({ djWavyWinner: "artist1" })).toBeNull();
    expect(pollWinnerOf({})).toBeNull();
    expect(pollWinnerOf(null)).toBeNull();
    expect(pollWinnerOf(undefined)).toBeNull();
  });

  it("rejects unexpected values rather than passing them through", () => {
    expect(pollWinnerOf({ pollWinner: "tie" })).toBeNull();
    expect(pollWinnerOf({ pollWinner: null })).toBeNull();
  });
});
