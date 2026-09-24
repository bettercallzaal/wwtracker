/**
 * The three launch read-actions on /api/ww/trade, at the ROUTE level.
 *
 * They were written with the launch screen (#392) and tested only through the
 * relay policy, which does not run them at all: `rent`, `fee` and `balance`
 * never touch `decideRelay`. So the gate, the allowlist and the null handling
 * had no coverage where they actually live. This is that coverage.
 *
 * These are the actions that price a launch, and the price is shown to
 * somebody about to spend real SOL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const realEnv = process.env;
const realFetch = globalThis.fetch;

/** Answers RPC calls by method, so the route's real call is exercised. */
function mockRpc(answers: Record<string, unknown>) {
  return vi.fn(async (_url: string, init: { body: string }) => {
    const { method } = JSON.parse(init.body);
    if (!(method in answers)) throw new Error(`unexpected rpc method in test: ${method}`);
    return {
      ok: true,
      json: async () => ({ jsonrpc: "2.0", id: 1, result: answers[method] }),
    } as unknown as Response;
  });
}

async function post(body: unknown) {
  const { POST } = await import("../../app/api/ww/trade/route");
  return POST(
    new Request("http://localhost/api/ww/trade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.resetModules();
  process.env = { ...realEnv, WW_LAUNCH: "1", WW_WIDGET: undefined, WW_OPERATOR: undefined };
});
afterEach(() => {
  process.env = realEnv;
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

describe("rent", () => {
  it("quotes a launch account size", async () => {
    globalThis.fetch = mockRpc({ getMinimumBalanceForRentExemption: 2_443_440 }) as unknown as typeof fetch;
    const body = await (await post({ action: "rent", bytes: 353 })).json();
    expect(body).toMatchObject({ status: "ok", bytes: 353, lamports: 2_443_440 });
  });

  it.each([0, 82, 353])("allows %i bytes, the sizes a launch creates", async (bytes) => {
    globalThis.fetch = mockRpc({ getMinimumBalanceForRentExemption: 1 }) as unknown as typeof fetch;
    expect((await post({ action: "rent", bytes })).status).toBe(200);
  });

  /**
   * AN ALLOWLIST, NOT A RANGE. Without it this is a way to ask our keyed
   * endpoint arbitrary questions at our expense.
   */
  it.each([1, 100, 352, 354, 10_000_000, -1])("refuses %i bytes", async (bytes) => {
    globalThis.fetch = mockRpc({}) as unknown as typeof fetch;
    const res = await post({ action: "rent", bytes });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/only for launch accounts/);
  });

  it("refuses a non-number, rather than coercing it", async () => {
    globalThis.fetch = mockRpc({}) as unknown as typeof fetch;
    // "353" is not 353. A loose check would pass this and a strict one must not.
    expect((await post({ action: "rent", bytes: "353" })).status).toBe(400);
    expect((await post({ action: "rent" })).status).toBe(400);
  });

  it("does not report a missing rent figure as a number", async () => {
    globalThis.fetch = mockRpc({ getMinimumBalanceForRentExemption: null }) as unknown as typeof fetch;
    const res = await post({ action: "rent", bytes: 353 });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/did not quote a rent figure/);
  });
});

describe("fee", () => {
  it("returns what the cluster charges", async () => {
    globalThis.fetch = mockRpc({ getFeeForMessage: { value: 5_000 } }) as unknown as typeof fetch;
    expect((await (await post({ action: "fee", message: "AQAB" })).json()).lamports).toBe(5_000);
  });

  /**
   * NULL, NOT ZERO. The screen turns null into a FLOOR and an UNKNOWN
   * affordability; a zero would be added to the total and quietly under-quote
   * a launch somebody is about to sign.
   */
  it("returns null when the cluster will not quote one", async () => {
    globalThis.fetch = mockRpc({ getFeeForMessage: { value: null } }) as unknown as typeof fetch;
    const body = await (await post({ action: "fee", message: "AQAB" })).json();
    expect(body.status).toBe("ok");
    expect(body.lamports).toBeNull();
  });

  it("refuses a missing or non-string message", async () => {
    globalThis.fetch = mockRpc({}) as unknown as typeof fetch;
    expect((await post({ action: "fee" })).status).toBe(400);
    expect((await post({ action: "fee", message: "" })).status).toBe(400);
    expect((await post({ action: "fee", message: 42 })).status).toBe(400);
  });
});

describe("balance", () => {
  it("returns lamports at an address", async () => {
    globalThis.fetch = mockRpc({ getBalance: { value: 1_473_500_000 } }) as unknown as typeof fetch;
    const body = await (
      await post({ action: "balance", address: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk" })
    ).json();
    expect(body.lamports).toBe(1_473_500_000);
  });

  it("refuses something that is not a base58 address", async () => {
    globalThis.fetch = mockRpc({}) as unknown as typeof fetch;
    for (const address of ["", "not an address", "0".repeat(44), 42, null]) {
      expect((await post({ action: "balance", address })).status).toBe(400);
    }
  });
});

describe("the gate", () => {
  /**
   * These actions exist for the launch screen and nothing else. On a
   * deployment that only trades, a caller asking for rent or a fee quote is
   * asking for something no screen there needs.
   */
  it("is 404 for all three when WW_LAUNCH is off, even with trading on", async () => {
    process.env = { ...realEnv, WW_LAUNCH: undefined, WW_WIDGET: "1" };
    globalThis.fetch = mockRpc({}) as unknown as typeof fetch;
    for (const body of [
      { action: "rent", bytes: 353 },
      { action: "fee", message: "AQAB" },
      { action: "balance", address: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk" },
    ]) {
      expect((await post(body)).status).toBe(404);
    }
  });

  it("the whole route is 404 when no flag at all is set", async () => {
    process.env = { ...realEnv, WW_LAUNCH: undefined, WW_WIDGET: undefined, WW_OPERATOR: undefined };
    globalThis.fetch = mockRpc({}) as unknown as typeof fetch;
    expect((await post({ action: "rent", bytes: 353 })).status).toBe(404);
  });

  /**
   * The red control: the same requests that 404 above must succeed with the
   * flag on, or the test above would pass for the wrong reason.
   */
  it("answers all three when WW_LAUNCH is on", async () => {
    globalThis.fetch = mockRpc({
      getMinimumBalanceForRentExemption: 1,
      getFeeForMessage: { value: 5_000 },
      getBalance: { value: 1 },
    }) as unknown as typeof fetch;
    expect((await post({ action: "rent", bytes: 353 })).status).toBe(200);
    expect((await post({ action: "fee", message: "AQAB" })).status).toBe(200);
    expect(
      (await post({ action: "balance", address: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk" }))
        .status,
    ).toBe(200);
  });
});
