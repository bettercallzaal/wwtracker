/**
 * The RPC-spending endpoints answer only where the interface they serve is on.
 *
 * Zaal ruled "actually restrict the endpoints" on 2026-09-22
 * (zao-vault/decisions/grill-2026-09-22-seat-afternoon.md, item 13). The thing
 * being restricted is a COST: each of these spends a keyed RPC call, the only
 * boundary was absent CORS headers, and the rate limit was per-IP, which does
 * not bound a determined caller.
 *
 * The restriction is not a token, because a token a public page can fetch is a
 * token anybody can fetch. It is that on the public deployment these routes
 * have no caller to serve: measured 2026-09-22, /widget and /operator are 404
 * there and the battle page renders its trading panel only when WW_WIDGET is
 * set. So each route now requires the flag of the interface it exists for.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anyConsumerEnabled, consumerEnabled } from "../ww/apiSurface";

const ON = { WW_WIDGET: "1", WW_OPERATOR: "1", WW_FINALS: "1" };
const OFF: Record<string, string | undefined> = {};

describe("consumerEnabled", () => {
  it("follows the flag of the interface, not a flag of its own", () => {
    expect(consumerEnabled("trading", { WW_WIDGET: "1" })).toBe(true);
    expect(consumerEnabled("trading", { WW_OPERATOR: "1" })).toBe(false);
    expect(consumerEnabled("operator", { WW_OPERATOR: "1" })).toBe(true);
    expect(consumerEnabled("finals", { WW_FINALS: "1" })).toBe(true);
    for (const c of ["trading", "operator", "finals"] as const) {
      expect(consumerEnabled(c, OFF)).toBe(false);
    }
  });
});

describe("anyConsumerEnabled", () => {
  it("answers for a route shared by two interfaces", () => {
    // /api/ww/trade serves the widget AND the operator page.
    expect(anyConsumerEnabled(["trading", "operator"], { WW_OPERATOR: "1" })).toBe(true);
    expect(anyConsumerEnabled(["trading", "operator"], { WW_WIDGET: "1" })).toBe(true);
    expect(anyConsumerEnabled(["trading", "operator"], OFF)).toBe(false);
    expect(anyConsumerEnabled([], ON)).toBe(false);
  });
});

/**
 * The routes themselves, called with the environment a public deployment has.
 * These assert the CLOSED case, which is the one that was wrong: an open route
 * is the normal path and is covered by every other test in this suite.
 */
describe("each RPC-spending route is 404 where its interface is off", () => {
  const realEnv = process.env;
  const fetchSpy = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...realEnv, WW_WIDGET: "", WW_OPERATOR: "", WW_FINALS: "" };
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });
  afterEach(() => {
    process.env = realEnv;
    vi.restoreAllMocks();
    fetchSpy.mockReset();
  });

  it("claimable, token-balance and diagnose refuse without spending an RPC call", async () => {
    const claimable = await (await import("../../app/api/ww/claimable/route")).GET(
      new Request("http://localhost/api/ww/claimable?wallet=4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk"),
    );
    const balance = await (await import("../../app/api/ww/token-balance/route")).GET(
      new Request("http://localhost/api/ww/token-balance?battleId=1790044803&wallet=4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk"),
    );
    const diagnose = await (await import("../../app/api/ww/diagnose/route")).GET(
      new Request("http://localhost/api/ww/diagnose?code=6014"),
    );
    for (const res of [claimable, balance, diagnose]) expect(res.status).toBe(404);
    // THE POINT OF THE CHANGE: no upstream call was made. A 404 that still
    // spent the RPC call would restrict the answer and not the cost.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the trade relay refuses too, and answers for the operator page alone", async () => {
    const body = JSON.stringify({ action: "prepare" });
    const closed = await (await import("../../app/api/ww/trade/route")).POST(
      new Request("http://localhost/api/ww/trade", { method: "POST", body, headers: { "content-type": "application/json" } }),
    );
    expect(closed.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env.WW_OPERATOR = "1";
    vi.resetModules();
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ result: { value: { blockhash: "x", lastValidBlockHeight: 1 } } }) });
    const open = await (await import("../../app/api/ww/trade/route")).POST(
      new Request("http://localhost/api/ww/trade", { method: "POST", body, headers: { "content-type": "application/json" } }),
    );
    expect(open.status).not.toBe(404);
  });
});
