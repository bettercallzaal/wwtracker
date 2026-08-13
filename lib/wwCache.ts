// Cached read-through to wavewarz.info, so partner embeds fan out from here
// instead of each site hitting Sam's origin directly.
//
// Why this exists: on the 2026-08-12 Space, two partners (Ignite Radio and Fat
// Music) asked on air for the API link so they could show live WaveWarZ stats on
// their own pages. That API has no key and no enforced rate limit, and it runs on
// someone else's infrastructure. Every embed that calls it directly adds sustained
// load he never agreed to, and the load scales with their traffic, not ours.
//
// One upstream call per revalidate window serves every downstream consumer,
// whatever their traffic.
//
// The failure contract is the important part. When upstream is unreachable this
// never invents a number:
//
//   live    - fetched fresh, data is current
//   stale   - upstream failed, serving the last good response, ageSeconds says how old
//   unknown - no good response has ever been seen, data is null
//
// A consumer that renders `unknown` as 0 is lying to its users. The payload makes
// that impossible to do by accident: on unknown, `data` is null rather than a
// zero-filled object.

export type CacheStatus = "live" | "stale" | "unknown";

export interface CachedPayload<T> {
  status: CacheStatus;
  /**
   * When THIS server last successfully read the payload. On a "live" response the
   * body may have come from the data cache, so this is a serve time, not proof of
   * an upstream call.
   *
   * For upstream freshness, read the upstream payload's own timestamp - `/stats`
   * carries `updatedAt`. On a "stale" response this is accurate: it is when the
   * last good body was actually stored.
   */
  fetchedAt: string | null;
  /** Seconds since `fetchedAt`. Null when status is "unknown". Meaningful mainly on "stale". */
  ageSeconds: number | null;
  /** Null when status is "unknown" - never a zero-filled placeholder. */
  data: T | null;
  source: string;
  /** Present when the most recent attempt failed, for debugging. Never includes upstream response bodies. */
  error?: string;
}

/**
 * Last-good store, per server instance.
 *
 * Deliberately in-memory: it survives upstream blips on a warm instance, which is
 * the common case. A cold instance with upstream down returns "unknown" rather
 * than a stale value it cannot vouch for - correct, if less useful. Persisting
 * this across instances would need external storage; that is a real upgrade, not
 * a bug fix, and is noted in the route's docs.
 */
const lastGood = new Map<string, { at: number; data: unknown }>();

/** Reject after `ms` without cancelling the underlying promise. See the note in cachedFetch. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`upstream timeout after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Test seam. Not exported from the package surface for app code. */
export function __resetCacheForTests(): void {
  lastGood.clear();
}

export interface FetchOptions {
  /** Seconds Next should serve its cached copy before re-fetching upstream. */
  revalidateSeconds?: number;
  /** Abort the upstream call after this many ms so a hung origin cannot hang us. */
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  now?: () => number;
}

/**
 * Read `url` through Next's data cache, falling back to the last good response.
 *
 * Never throws: upstream problems are represented in the returned payload so a
 * route can always answer, and a consumer can always tell live from stale from
 * unknown.
 */
export async function cachedFetch<T>(
  key: string,
  url: string,
  opts: FetchOptions = {},
): Promise<CachedPayload<T>> {
  const {
    revalidateSeconds = 60,
    timeoutMs = 8000,
    fetchImpl = fetch,
    now = Date.now,
  } = opts;

  const source = new URL(url).host;

  try {
    // Deliberately NO AbortSignal here. Next opts a fetch out of the Data Cache
    // when it carries a `signal`, which would send every request upstream and
    // defeat the one thing this module exists to do.
    //
    // The timeout is therefore a race rather than a cancellation: it stops a hung
    // origin from hanging our route, but does not abort the underlying request,
    // which completes in the background and still populates the cache.
    //
    // Verified against a running server: six rapid requests all returned the same
    // upstream `updatedAt`, i.e. one upstream response served them all.
    const res = await withTimeout(
      fetchImpl(url, {
        // One upstream call per window, shared by every downstream consumer.
        next: { revalidate: revalidateSeconds },
      } as RequestInit),
      timeoutMs,
    );

    if (!res.ok) throw new Error(`upstream ${res.status}`);

    const data = (await res.json()) as T;
    const at = now();
    lastGood.set(key, { at, data });
    return {
      status: "live",
      fetchedAt: new Date(at).toISOString(),
      ageSeconds: 0,
      data,
      source,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "upstream unreachable";
    const prev = lastGood.get(key);

    if (!prev) {
      // Nothing to serve. Say so plainly rather than shipping a zero.
      return {
        status: "unknown",
        fetchedAt: null,
        ageSeconds: null,
        data: null,
        source,
        error: message,
      };
    }

    return {
      status: "stale",
      fetchedAt: new Date(prev.at).toISOString(),
      ageSeconds: Math.max(0, Math.round((now() - prev.at) / 1000)),
      data: prev.data as T,
      source,
      error: message,
    };
  }
}
