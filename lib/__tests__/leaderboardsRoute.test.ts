import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetCacheForTests } from "../wwCache";
import { TRADER_PNL_WITHDRAWN } from "../traderLeaderboard";

/**
 * The widget hides Net P&L when TRADER_PNL_WITHDRAWN is true (see
 * lib/__tests__/traderLeaderboard.test.ts), but /api/ww/leaderboards/traders is
 * a public JSON endpoint any embedder can call directly, bypassing the rendered
 * table entirely. Hiding the column only in the widget would leave the figure
 * sitting in this response for anyone who reads the JSON instead of the page -
 * this asserts the route itself strips it.
 */
describe("GET /api/ww/leaderboards/traders", () => {
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    __resetCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.restoreAllMocks();
  });

  it("strips netPnlSol, netPnlFmt, netPnlUsd and netPnlPositive while the column is withdrawn", async () => {
    // This test exercises the withdrawn branch, which is the live one. If a
    // scan ever restores the column, that branch is the pass-through case the
    // route already had before this fix - untested drift there would show up
    // as the figure simply appearing again, which the widget-side tests catch.
    expect(TRADER_PNL_WITHDRAWN).toBe(true);

    const upstreamTrader = {
      wallet: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
      totalVolumeSol: 12.3,
      totalVolumeSolFmt: "12.30",
      totalVolumeUsd: "$1,000.00",
      tradeCount: 4,
      battleCount: 2,
      wins: 1,
      losses: 1,
      winRate: 50,
      netPnlSol: -1.2,
      netPnlFmt: "-1.20",
      netPnlUsd: "-$100.00",
      netPnlPositive: false,
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        updatedAt: "2026-09-28T00:00:00Z",
        solPriceUsd: 100,
        count: 1,
        traders: [upstreamTrader],
      }),
    }) as unknown as typeof fetch;

    const { GET } = await import("../../app/api/ww/leaderboards/[kind]/route");
    const res = await GET(
      new Request("http://localhost/api/ww/leaderboards/traders?limit=5"),
      { params: Promise.resolve({ kind: "traders" }) },
    );
    const body = await res.json();
    const [trader] = body.data.traders as Record<string, unknown>[];

    expect(trader).not.toHaveProperty("netPnlSol");
    expect(trader).not.toHaveProperty("netPnlFmt");
    expect(trader).not.toHaveProperty("netPnlUsd");
    expect(trader).not.toHaveProperty("netPnlPositive");
    // Fields the withdrawal does not touch survive unchanged.
    expect(trader.wallet).toBe(upstreamTrader.wallet);
    expect(trader.winRate).toBe(50);
    expect(trader.totalVolumeSol).toBe(12.3);
  });

  it("leaves artists untouched - the strip is scoped to the traders kind", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ artists: [{ name: "AI LUI", wins: 5 }] }),
    }) as unknown as typeof fetch;

    const { GET } = await import("../../app/api/ww/leaderboards/[kind]/route");
    const res = await GET(
      new Request("http://localhost/api/ww/leaderboards/artists?limit=5"),
      { params: Promise.resolve({ kind: "artists" }) },
    );
    const body = await res.json();
    expect(body.data.artists).toEqual([{ name: "AI LUI", wins: 5 }]);
  });
});
