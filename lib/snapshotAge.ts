/**
 * How old the baked snapshot is, in words a reader can act on.
 *
 * Three components print `WW.generatedAt` - an ISO timestamp - beside figures
 * taken from it. That is honest and it is not legible: "snapshot
 * 2026-09-09T11:52Z" does not tell anybody the numbers beside it are eighteen
 * days old, and `scripts/validate.mjs` has been warning about exactly that
 * since 2026-09-05 where only a developer sees it.
 *
 * The treasury panel already learned this lesson (#355): it now reads
 * "Treasury file through 2026-07-21 (63 days ago)" instead of labelling
 * two-month-old rows "this week". This is the same sentence for the snapshot.
 *
 * It does not editorialise below a fortnight, because a week-old all-time
 * volume figure is not misleading and a badge on every page that always says
 * something is a badge nobody reads.
 */

/** Days between the snapshot and now, or null when the stamp cannot be parsed. */
export function snapshotAgeDays(generatedAt: string, now: number = Date.now()): number | null {
  const t = Date.parse(generatedAt);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

/**
 * The stamp with its age appended once the age is worth saying.
 *
 * An unparseable stamp returns the raw string rather than inventing an age:
 * the caller already renders it, and replacing it with "unknown" would hide a
 * value somebody may need to recognise.
 */
export function describeSnapshotAge(generatedAt: string, now: number = Date.now(), noticeAfterDays = 14): string {
  const days = snapshotAgeDays(generatedAt, now);
  if (days === null) return generatedAt;
  if (days < noticeAfterDays) return generatedAt;
  return `${generatedAt} (${days} days ago)`;
}
