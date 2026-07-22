import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getPublicStats,
  getPublicBattles,
  getPublicBattleById,
  getPublicEvents,
  getArtistLeaderboard,
  getTraderLeaderboard,
  getSongLeaderboard,
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
  it("getArtistLeaderboard defaults limit to 100", async () => {
    const fn = mockFetchOnce([]);
    await getArtistLeaderboard();
    expect(fn).toHaveBeenCalledWith("https://wavewarz.info/api/public/leaderboards/artists?limit=100");
  });

  it("getTraderLeaderboard respects a custom limit", async () => {
    const fn = mockFetchOnce([]);
    await getTraderLeaderboard(10);
    expect(fn).toHaveBeenCalledWith("https://wavewarz.info/api/public/leaderboards/traders?limit=10");
  });

  it("getSongLeaderboard builds sort + limit params", async () => {
    const fn = mockFetchOnce([]);
    await getSongLeaderboard({ sort: "battles", limit: 10 });
    const params = new URL(fn.mock.calls[0][0] as string).searchParams;
    expect(params.get("sort")).toBe("battles");
    expect(params.get("limit")).toBe("10");
  });
});
