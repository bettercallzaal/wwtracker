// Pure rate-limit policy for the saved-query execute path. Split out of dune.ts
// for the same reason dune-normalize.ts was: dune.ts imports "server-only",
// which has no real npm package and cannot resolve under vitest.
//
// WHY THIS IS A RATE LIMIT AND NOT AN AUTH CHECK
//
// `/api/balance?refresh=1` asks Dune to RE-RUN the treasury query. An execute
// costs credits, so the endpoint cannot be left open to anyone who can reach
// the URL. It used to be gated on a CRON_SECRET bearer token, and that gate
// failed closed: with the env var unset the route answered 401, the execute
// never fired, and the chart sat on a 2026-07-03 execution for 64 days while
// the UI and the README both called it live. A missing environment variable
// and a hostile caller produced the identical response, and both were silent.
//
// The thing actually worth protecting is credits, and credits are spent per
// execute - so capping executes per unit time protects it directly, without a
// secret that can go missing. An unauthenticated caller can still force the
// day's single execute to happen at a time of their choosing; they cannot make
// it happen twice. The cron time is arbitrary anyway, so that is not a cost.
//
// The rate-limit state is Dune's own: its results envelope reports when the
// last execution ended, so the freshness of the stored result IS the counter.
// Nothing is persisted on our side, which matters on Vercel where any request
// may land on a cold lambda with empty memory.

/**
 * Minimum age of the stored execution before a refresh will re-run the query.
 *
 * Must stay comfortably below the cron's 24h period or the cron would block
 * itself: a run at 09:00 leaves a result exactly 24h old at the next 09:00, and
 * jitter either side of that makes the comparison a coin flip. 20h leaves four
 * hours of margin while still capping spend at about one execute per day.
 */
export const REFRESH_MIN_AGE_MS = 20 * 60 * 60 * 1000;

/** Shape of the timestamps Dune returns alongside a query's results. */
export interface ExecutionTimestamps {
  execution_ended_at?: unknown;
  execution_started_at?: unknown;
  submitted_at?: unknown;
}

/**
 * Epoch ms of the last completed execution, or null if Dune did not report a
 * parseable timestamp.
 *
 * Prefers the end of execution because that is when the rows we are holding
 * became true; falls back through start and submission so a schema change that
 * drops one field degrades to a slightly conservative answer rather than to
 * null.
 */
export function parseExecutionEndedAt(envelope: unknown): number | null {
  if (!envelope || typeof envelope !== "object") return null;
  const e = envelope as ExecutionTimestamps;
  for (const raw of [e.execution_ended_at, e.execution_started_at, e.submitted_at]) {
    if (typeof raw !== "string") continue;
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) return ms;
  }
  return null;
}

export type RefreshDecision =
  | { execute: true; reason: "stale" | "unknown-age"; ageMs: number | null }
  | { execute: false; reason: "fresh"; ageMs: number };

/**
 * Decide whether a refresh request should spend a Dune credit.
 *
 * Fails OPEN when the age cannot be determined. That is deliberate and it is
 * the whole lesson of the 64-day freeze: refusing to act because we could not
 * confirm the state is exactly how a stale number gets served confidently for
 * two months. One surplus execute is cheaper than another silent freeze, and
 * the caller reports which branch it took so the choice is visible rather than
 * inferred.
 *
 * Do not read that as a general rule, because it is not one. Which direction
 * to fail is decided by what the endpoint DOES, not by which feels safer. This
 * one re-runs a read-only query and the worst case is a wasted credit, so it
 * fails open. An endpoint with a side effect - deactivating accounts, moving
 * funds, sending mail - must fail closed on the same uncertainty, because there
 * the worst case is unrecoverable. Same failure class, opposite correct answer.
 * (zaostock's cron gate is the fail-closed sibling: its endpoint deactivates
 * team members, so it throws on an unset secret and answers 401.)
 */
export function decideRefresh(input: {
  lastExecutionMs: number | null;
  nowMs: number;
  minAgeMs?: number;
}): RefreshDecision {
  const { lastExecutionMs, nowMs, minAgeMs = REFRESH_MIN_AGE_MS } = input;

  if (lastExecutionMs === null || !Number.isFinite(lastExecutionMs)) {
    return { execute: true, reason: "unknown-age", ageMs: null };
  }

  // Clamp negatives: a timestamp in the future means clock skew between Dune
  // and us, not a result from the future. Treating it as age 0 declines to
  // execute, which is the safe direction - it spends nothing, and the next
  // call once the skew passes will re-run normally.
  const ageMs = Math.max(0, nowMs - lastExecutionMs);

  return ageMs >= minAgeMs
    ? { execute: true, reason: "stale", ageMs }
    : { execute: false, reason: "fresh", ageMs };
}
