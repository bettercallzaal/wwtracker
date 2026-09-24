/**
 * WHICH WATCHER LOG A HEALTH CHECK SHOULD READ.
 *
 * `scripts/ww-doctor.ts` read one hardcoded path,
 * `~/.zao/wwtracker/finals-watch.log`, while `scripts/ww-night.sh` has
 * redirected the watcher to `var/ww-live-watch.log` since it was written. On
 * 2026-09-24 the doctor reported "last wrote 224510s ago - Probably dead" and
 * "1 MISMATCH line(s)" while the real watcher was beating every three seconds
 * two directories away.
 *
 * **A health check pointed at the wrong file is worse than none.** It cries
 * wolf, and the numbers it does report belong to a run nobody is watching -
 * that stale log's mismatch count was being read as today's.
 *
 * The rule is the newest log that exists, and the caller PRINTS which one it
 * chose. Naming the surface you read is the difference between a finding and
 * a guess.
 */

export interface WatcherLogCandidate {
  path: string;
  /** Epoch ms of the last write. */
  mtimeMs: number;
}

/**
 * The most recently written candidate, or null when none exist.
 *
 * Ties go to the earlier entry, so the list order is the tiebreak and a caller
 * can express a preference by ordering it.
 */
export function newestWatcherLog(
  candidates: WatcherLogCandidate[],
): WatcherLogCandidate | null {
  let best: WatcherLogCandidate | null = null;
  for (const c of candidates) {
    if (best === null || c.mtimeMs > best.mtimeMs) best = c;
  }
  return best;
}

/** Seconds since a log was last written. */
export const watcherLogAgeSeconds = (mtimeMs: number, now = Date.now()): number =>
  Math.floor((now - mtimeMs) / 1000);

/**
 * The watcher beats every 60 s, so three missed beats is dead.
 *
 * Returned as a verdict rather than a boolean so "no beats at all" stays a
 * separate answer from "beating" and from "stopped": a log that exists and has
 * never beaten means started seconds ago, or stuck, and calling that dead
 * would be wrong in the same way calling it healthy would be.
 */
export type WatcherVerdict = "beating" | "stopped" | "never-beat" | "clock-suspect";

export function watcherVerdict(ageSeconds: number, beatCount: number): WatcherVerdict {
  if (beatCount === 0) return "never-beat";
  // A NEGATIVE AGE IS NOT A YOUNG LOG. It is a write stamped after now, which
  // cannot have happened: clock skew between this process and whatever wrote
  // the file, a restored backup carrying its old mtime, a machine that changed
  // timezone mid-run. Returning "beating" for it was reporting a healthy
  // watcher on the strength of a timestamp that cannot be true, and the whole
  // point of this module is that a health check which reads the wrong thing is
  // worse than no health check.
  //
  // It is a separate verdict rather than "stopped" because the watcher may well
  // be fine - what is broken is our ability to say so. Those are different
  // things and collapsing them loses the one fact worth acting on.
  if (ageSeconds < 0) return "clock-suspect";
  return ageSeconds > 180 ? "stopped" : "beating";
}
