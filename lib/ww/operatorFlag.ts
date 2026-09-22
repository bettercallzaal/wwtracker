/**
 * WW_OPERATOR gates /operator and /api/ww/unsettled, the way WW_WIDGET gates
 * /widget. Same shape, same reasons: off by default, a 404 rather than a
 * hidden link, not a NEXT_PUBLIC_ variable. Separate from WW_WIDGET because
 * settling battles is an operator's act and trading is a trader's, and a
 * deployment can want one without the other.
 */
const ON = new Set(["1", "true", "yes", "on"]);

export function operatorEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.WW_OPERATOR;
  if (typeof raw !== "string") return false;
  return ON.has(raw.trim().toLowerCase());
}
