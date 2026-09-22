/**
 * The two reads a panel polls right after a trade or a claim must answer at
 * "confirmed", not the RPC's default "finalized".
 *
 * WHY. After a claim lands, the claim panel polls /api/ww/claimable until the
 * claimed battle leaves the list (10 x 1.5 s); after a trade, the widget polls
 * /api/ww/token-balance until the balance moves (10 x 1.5 s). Neither route
 * passed a commitment, so both read at the node's default, finalized, which
 * trails confirmed by about 13 s. A landed claim was invisible to the panel
 * for most of its 15 s budget; it worked on 2026-09-21 only because the
 * server-side confirmation wait (#352) usually spent that time first.
 * Found by audit 2026-09-22, not by a failure.
 *
 * "confirmed" is the cluster's supermajority vote, the level wallets show
 * balances at; "processed" would be one node's word and is not used.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const WALLET = "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk";
const realFetch = globalThis.fetch;
beforeEach(() => vi.resetModules());
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

const ok = (result: unknown) => ({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) }) as unknown as Response;

describe("post-action reads answer at confirmed", () => {
  it("token-balance asks getTokenAccountBalance at confirmed, both sides", async () => {
    const calls: unknown[][] = [];
    globalThis.fetch = vi.fn(async (_u: string, init: { body: string }) => {
      const { method, params } = JSON.parse(init.body);
      calls.push([method, params]);
      return ok({ value: { amount: "0", decimals: 0, uiAmount: 0, uiAmountString: "0" } });
    }) as unknown as typeof fetch;
    const { GET } = await import("../../app/api/ww/token-balance/route");
    const res = await GET(new Request(`http://localhost/api/ww/token-balance?battleId=1790044803&wallet=${WALLET}`));
    expect(res.status).toBe(200);
    expect(calls.length).toBe(2);
    for (const [method, params] of calls) {
      expect(method).toBe("getTokenAccountBalance");
      expect((params as unknown[])[1]).toEqual({ commitment: "confirmed" });
    }
  });

  it("claimable asks getTokenAccountsByOwner at confirmed, for both token programs", async () => {
    const calls: unknown[][] = [];
    globalThis.fetch = vi.fn(async (_u: string, init: { body: string }) => {
      const { method, params } = JSON.parse(init.body);
      calls.push([method, params]);
      return ok({ value: [] });
    }) as unknown as typeof fetch;
    const { GET } = await import("../../app/api/ww/claimable/route");
    const res = await GET(new Request(`http://localhost/api/ww/claimable?wallet=${WALLET}`));
    expect(res.status).toBe(200);
    const owned = calls.filter(([m]) => m === "getTokenAccountsByOwner");
    expect(owned.length).toBe(2);
    for (const [, params] of owned) expect((params as unknown[])[2]).toMatchObject({ commitment: "confirmed" });
  });

  it("claimable reads the mints, battles and vaults at the same commitment as the balances", async () => {
    const calls: unknown[][] = [];
    const mint = "So11111111111111111111111111111111111111112";
    globalThis.fetch = vi.fn(async (_u: string, init: { body: string }) => {
      const { method, params } = JSON.parse(init.body);
      calls.push([method, params]);
      if (method === "getTokenAccountsByOwner") {
        const classic = params[1].programId === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
        return ok({ value: classic ? [{ account: { data: { parsed: { info: { mint, tokenAmount: { amount: "5" } } } } } }] : [] });
      }
      return ok({ value: [null] });
    }) as unknown as typeof fetch;
    const { GET } = await import("../../app/api/ww/claimable/route");
    await GET(new Request(`http://localhost/api/ww/claimable?wallet=${WALLET}`));
    const multi = calls.filter(([m]) => m === "getMultipleAccounts");
    expect(multi.length).toBeGreaterThan(0);
    for (const [, params] of multi) expect((params as unknown[])[1]).toMatchObject({ commitment: "confirmed" });
  });
});
