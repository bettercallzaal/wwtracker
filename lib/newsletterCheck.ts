// The check that a draft only states figures we actually fetched.
//
// Pure and separate from newsletterFacts.ts because that module imports
// "server-only", which has no real npm package and cannot resolve under
// vitest. Same split as dune-normalize.ts and dune.ts - and this is exactly
// the logic that most needs testing, since it is the last thing standing
// between a model's invented number and an email to every subscriber.

/**
 * Does the draft state any number that is not in the fact sheet?
 *
 * Not a proof - prose legitimately contains numbers that are not statistics
 * (dates, ordinals, "one of the"). It catches the case that actually matters:
 * a confident SOL figure the model made up. Anything flagged is shown to the
 * writer to check, never silently removed.
 */
export function findUnsourcedFigures(draft: string, figures: Record<string, number>): string[] {
  const allowed = new Set<string>();
  for (const v of Object.values(figures)) {
    allowed.add(String(v));
    allowed.add(v.toFixed(0));
    allowed.add(v.toFixed(1));
    allowed.add(v.toFixed(2));
    allowed.add(v.toFixed(3));
    allowed.add(Math.round(v).toLocaleString("en-US"));
  }
  const suspicious: string[] = [];
  // Numbers presented as SOL amounts are the ones worth challenging.
  for (const m of draft.matchAll(/([\d,]+\.?\d*)\s*SOL/gi)) {
    const raw = m[1].replace(/,/g, "");
    if (!allowed.has(raw) && !allowed.has(Number(raw).toFixed(3))) {
      suspicious.push(`${m[1]} SOL`);
    }
  }
  return [...new Set(suspicious)];
}
