/**
 * Whether the live dashboard exists on this deployment.
 *
 * **OFF BY DEFAULT, AND THE REASON IS RPC BUDGET RATHER THAN SECRECY.**
 * `/finals` polls `/api/ww/live-battles` every five seconds per viewer, and
 * that route runs `getProgramAccounts` over ~1,700 accounts on each request.
 * The public Solana endpoint throttles per method: this session exhausted
 * `getTransaction` on it in an afternoon of exactly that kind of polling, and
 * it took about an hour to come back.
 *
 * So an unlisted page left open by a handful of people during a show can spend
 * the same budget the operator's own dashboard is running on. The failure does
 * not look like an outage - it looks like the health check going amber and the
 * battle cards going stale, mid-show, for a reason nobody would connect to a
 * deploy. Zaal chose the flag over carrying that risk, 2026-09-20.
 *
 * Same shape as `paperFlag.ts` and `widgetFlag.ts`: it lives in `lib/` rather
 * than `lib/ww/` because the SDK surface may not read `process`, and
 * `WW_FINALS` carries no `NEXT_PUBLIC_` prefix so it is never inlined into a
 * client bundle. Unset is off. Anything other than the strings below is off,
 * so a flag set to "false" cannot enable a page by being a non-empty string.
 */
const ON = new Set(["1", "true", "yes", "on"]);

export function finalsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.WW_FINALS;
  if (typeof raw !== "string") return false;
  return ON.has(raw.trim().toLowerCase());
}
