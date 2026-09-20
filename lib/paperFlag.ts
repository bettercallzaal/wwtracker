/**
 * Whether the dynamic whitepaper exists on this deployment.
 *
 * IT LIVES IN `lib/` AND NOT `lib/ww/`, and the test suite is why. `lib/ww` is
 * the portable SDK surface - zero dependencies, no `process`, so it can be
 * lifted into somebody else's stack. `wwSdkBoundary.test.ts` allows exactly one
 * exception there, the widget flag, because that gate stands between a
 * read-only site and one that moves money. This page moves nothing, so it has
 * no claim on the exception and the guard was right to refuse it. Widening an
 * allowlist to fit a new file is how a boundary stops being one.
 *
 * SAME SHAPE AS `widgetFlag.ts`, ON PURPOSE. `WW_PAPER` has no `NEXT_PUBLIC_`
 * prefix, so Next does not inline it into the client bundle and the check can
 * only run on the server. Unset means off, and anything other than the exact
 * strings below is off too - a flag set to "false" must not enable a page
 * because it happens to be a non-empty string.
 *
 * WHY A READ-ONLY PAGE NEEDS A GATE AT ALL. The widget's gate stands between a
 * read-only site and one that moves money. This one is different: a route on a
 * deployed site is public the moment it exists, and Zaal has not said publish.
 * The gate is what makes "built but not published" a real state rather than an
 * intention. It comes off when he says so, not when the page is finished.
 */
const ON = new Set(["1", "true", "yes", "on"]);

export function paperEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.WW_PAPER;
  if (typeof raw !== "string") return false;
  return ON.has(raw.trim().toLowerCase());
}

/** Seconds between rebuilds. Zaal's ruling 2026-09-20, via the vault grill: hourly. */
export const PAPER_REVALIDATE_SECONDS = 3600;
