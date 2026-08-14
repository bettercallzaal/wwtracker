import { describe, it, expect, vi, beforeEach } from "vitest";
import { cachedFetch, __resetCacheForTests } from "@/lib/wwCache";
import { cacheHeaderFor, CORS_HEADERS } from "@/lib/wwPublicRoute";

const URL_STATS = "https://wavewarz.info/api/public/stats";

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as typeof fetch;
}

function failFetch(status = 503) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
  }) as unknown as typeof fetch;
}

function throwingFetch(message = "network down") {
  return vi.fn().mockRejectedValue(new Error(message)) as unknown as typeof fetch;
}

beforeEach(() => {
  __resetCacheForTests();
});

describe("cachedFetch - the happy path", () => {
  it("returns live with the upstream body and zero age", async () => {
    const r = await cachedFetch<{ battles: number }>("k", URL_STATS, {
      fetchImpl: okFetch({ battles: 1385 }),
      now: () => 1_000_000,
    });
    expect(r.status).toBe("live");
    expect(r.data).toEqual({ battles: 1385 });
    expect(r.ageSeconds).toBe(0);
    expect(r.fetchedAt).toBe(new Date(1_000_000).toISOString());
    expect(r.source).toBe("wavewarz.info");
  });

  it("passes the revalidate window to fetch so one call serves the window", async () => {
    const fn = okFetch({ ok: true });
    await cachedFetch("k", URL_STATS, { fetchImpl: fn, revalidateSeconds: 60 });
    const init = (fn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(init.next).toEqual({ revalidate: 60 });
  });
});

describe("cachedFetch - failure must never invent a number", () => {
  it("returns unknown with null data when nothing has ever succeeded", async () => {
    const r = await cachedFetch("cold", URL_STATS, { fetchImpl: throwingFetch() });
    expect(r.status).toBe("unknown");
    // The whole point: null, not a zero-filled object a consumer might render as 0.
    expect(r.data).toBeNull();
    expect(r.fetchedAt).toBeNull();
    expect(r.ageSeconds).toBeNull();
  });

  it("treats a non-ok upstream response as a failure, not as data", async () => {
    const r = await cachedFetch("cold", URL_STATS, { fetchImpl: failFetch(503) });
    expect(r.status).toBe("unknown");
    expect(r.data).toBeNull();
    expect(r.error).toContain("503");
  });

  it("serves the last good response with an honest age when upstream dies", async () => {
    let t = 1_000_000;
    await cachedFetch("k", URL_STATS, { fetchImpl: okFetch({ battles: 1385 }), now: () => t });

    t = 1_000_000 + 90_000; // 90 seconds later
    const r = await cachedFetch<{ battles: number }>("k", URL_STATS, {
      fetchImpl: throwingFetch("ECONNREFUSED"),
      now: () => t,
    });

    expect(r.status).toBe("stale");
    expect(r.data).toEqual({ battles: 1385 });
    expect(r.ageSeconds).toBe(90);
    expect(r.error).toContain("ECONNREFUSED");
  });

  it("keeps serving the last good value across repeated failures", async () => {
    await cachedFetch("k", URL_STATS, { fetchImpl: okFetch({ v: 1 }) });
    for (let i = 0; i < 3; i += 1) {
      const r = await cachedFetch<{ v: number }>("k", URL_STATS, { fetchImpl: throwingFetch() });
      expect(r.status).toBe("stale");
      expect(r.data).toEqual({ v: 1 });
    }
  });

  it("recovers to live once upstream comes back", async () => {
    await cachedFetch("k", URL_STATS, { fetchImpl: okFetch({ v: 1 }) });
    await cachedFetch("k", URL_STATS, { fetchImpl: throwingFetch() });
    const r = await cachedFetch<{ v: number }>("k", URL_STATS, { fetchImpl: okFetch({ v: 2 }) });
    expect(r.status).toBe("live");
    expect(r.data).toEqual({ v: 2 });
  });

  it("keeps separate keys separate", async () => {
    await cachedFetch("a", URL_STATS, { fetchImpl: okFetch({ which: "a" }) });
    const b = await cachedFetch("b", URL_STATS, { fetchImpl: throwingFetch() });
    // Key "b" has no history of its own and must not borrow "a"'s.
    expect(b.status).toBe("unknown");
    expect(b.data).toBeNull();
  });

  it("never throws, whatever upstream does", async () => {
    await expect(
      cachedFetch("k", URL_STATS, { fetchImpl: throwingFetch("boom") }),
    ).resolves.toBeDefined();
  });
});

describe("response headers", () => {
  it("lets any origin embed - that is the point of a fan-out surface", () => {
    expect(CORS_HEADERS["Access-Control-Allow-Origin"]).toBe("*");
  });

  it("allows CDN caching for live and stale", () => {
    expect(cacheHeaderFor("live")).toContain("s-maxage=60");
    expect(cacheHeaderFor("stale")).toContain("stale-while-revalidate");
  });

  it("never caches unknown - it would pin 'no data' after upstream recovers", () => {
    expect(cacheHeaderFor("unknown")).toBe("no-store");
  });
});
