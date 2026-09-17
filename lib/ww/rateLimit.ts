/**
 * Budget for the trade relay, because CORS stops browsers and nothing else.
 *
 * WHAT THIS IS ACTUALLY PROTECTING. Not the relay - `relayPolicy.ts` already
 * decides which transactions are ours to forward. This protects the KEY. The
 * route spends `SOLANA_RPC_URL` on request, that endpoint is keyed, and its
 * per-minute budget is what keeps `/live` up. `lib/redact.ts` was written after
 * that key leaked and its comment already names this failure: "Anyone holding it
 * can exhaust it, and the page fails in a way that reads as a broken deployment
 * rather than as contention." An unmetered relay is a second way to reach the
 * same outcome, reached with `curl` rather than a stolen credential.
 *
 * So the policy stops misuse of a transaction and this stops abuse of call
 * volume. Different problems; the first does nothing about the second.
 *
 * THE GLOBAL CEILING IS THE REAL PROTECTION, not the per-caller bucket. Per-IP
 * limiting does nothing against a hundred IPs, and it is a hundred IPs that
 * would take `/live` down. The global budget is a hard ceiling on RPC calls this
 * route can cause per minute no matter who asks, which is the only limit that
 * bounds the damage to the thing being protected.
 *
 * KNOWN LIMIT, stated rather than hidden: this is in-memory, so it is per server
 * instance. Several instances mean several budgets, and a cold start resets one.
 * That makes it a mitigation, not a guarantee. It is still worth having - the
 * unbounded version has no ceiling at all - and the honest fix is shared storage,
 * which is a real change and not a patch. Same shape as the last-good store's
 * known limitation in docs/PUBLIC-API.md.
 */

export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds to wait, for a Retry-After header. Only meaningful when denied. */
  retryAfter: number;
  reason?: string;
}

interface Bucket {
  count: number;
  windowStart: number;
}

/** Per-caller, per-minute. Generous for a person, useless for a loop. */
export const PER_CALLER_PER_MINUTE = 20;

/**
 * Every RPC-spending call this route may cause per minute, across all callers.
 * Sized well under what `/live` needs to stay healthy rather than at the
 * endpoint's limit: the point is to leave headroom, not to use it all up.
 */
export const GLOBAL_PER_MINUTE = 120;

const WINDOW_MS = 60_000;

/**
 * Fixed windows rather than a token bucket. A fixed window lets through up to
 * twice the limit across a boundary, which is a real and accepted weakness -
 * the ceiling exists to bound a sustained hammer, and 2x for one second does not
 * threaten it. The alternative costs per-caller timestamp arrays, and an
 * unbounded map of those is its own memory-exhaustion path.
 */
export class RelayBudget {
  private callers = new Map<string, Bucket>();
  private global: Bucket = { count: 0, windowStart: 0 };

  constructor(
    private perCaller = PER_CALLER_PER_MINUTE,
    private globalLimit = GLOBAL_PER_MINUTE,
  ) {}

  /** Bounds the map: without it, distinct caller keys are a memory leak. */
  private static MAX_TRACKED_CALLERS = 5_000;

  private roll(bucket: Bucket, now: number): Bucket {
    if (now - bucket.windowStart >= WINDOW_MS) {
      bucket.count = 0;
      bucket.windowStart = now;
    }
    return bucket;
  }

  private secondsLeft(bucket: Bucket, now: number): number {
    return Math.max(1, Math.ceil((bucket.windowStart + WINDOW_MS - now) / 1000));
  }

  /**
   * Check and consume in one call. Deliberately not split into peek-then-take:
   * two callers between the peek and the take is exactly how a limit leaks.
   */
  take(caller: string, now = Date.now()): RateLimitDecision {
    // Global first. A caller under their own limit still cannot have the last of
    // a budget that is gone, and checking it first means a flood of new callers
    // cannot each get one through.
    this.roll(this.global, now);
    if (this.global.count >= this.globalLimit) {
      return {
        allowed: false,
        retryAfter: this.secondsLeft(this.global, now),
        reason: "the relay is at its global budget for this minute",
      };
    }

    if (this.callers.size > RelayBudget.MAX_TRACKED_CALLERS) {
      for (const [key, bucket] of this.callers) {
        if (now - bucket.windowStart >= WINDOW_MS) this.callers.delete(key);
      }
      // Still full of live buckets: that is itself the flood, and the global
      // ceiling above is what is holding it. Do not grow without bound.
      if (this.callers.size > RelayBudget.MAX_TRACKED_CALLERS) {
        return {
          allowed: false,
          retryAfter: 60,
          reason: "the relay is tracking too many callers",
        };
      }
    }

    const bucket = this.roll(
      this.callers.get(caller) ?? { count: 0, windowStart: now },
      now,
    );
    this.callers.set(caller, bucket);

    if (bucket.count >= this.perCaller) {
      return {
        allowed: false,
        retryAfter: this.secondsLeft(bucket, now),
        reason: `over ${this.perCaller} requests a minute`,
      };
    }

    bucket.count++;
    this.global.count++;
    return { allowed: true, retryAfter: 0 };
  }

  /** For tests and for a status line. Never for a decision - `take` decides. */
  snapshot(now = Date.now()) {
    this.roll(this.global, now);
    return { globalUsed: this.global.count, trackedCallers: this.callers.size };
  }
}

/**
 * Who is calling, from the proxy headers. Falls back to a single shared key
 * rather than to something unique-per-request: an unknown caller must share a
 * budget, because a per-request identity is no limit at all.
 */
export function callerKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
