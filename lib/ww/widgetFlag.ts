/**
 * Whether the trading widget exists on this deployment.
 *
 * Its own module so the decision is unit-testable and so there is exactly one
 * of it. A gate that is re-implemented per call site eventually has a call site
 * that got it wrong, and this particular gate is what stands between a
 * read-only site and a page that moves money.
 *
 * SERVER-ONLY BY CONSTRUCTION. `WW_WIDGET` has no `NEXT_PUBLIC_` prefix, so
 * Next.js does not inline it into the client bundle - the check can only run on
 * the server, which is what makes it a gate rather than a hint. A
 * `NEXT_PUBLIC_` flag would ship its own value to every visitor and could be
 * flipped in a console.
 *
 * DEFAULT OFF, and unset means off. Anything other than the exact strings below
 * is off too: a flag set to "false" or "0" or "no" must not enable a money
 * surface because it happens to be a non-empty string, which is what a plain
 * truthiness check would do.
 */
const ON = new Set(["1", "true", "yes", "on"]);

/**
 * Takes a plain string map rather than `NodeJS.ProcessEnv`, which requires
 * `NODE_ENV` and would make a test invent one it does not care about. An
 * environment is a string map; typing it as the one key this reads trips
 * TypeScript's weak-type check for any caller that happens to share no keys.
 */
export function widgetEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.WW_WIDGET;
  if (typeof raw !== "string") return false;
  return ON.has(raw.trim().toLowerCase());
}
