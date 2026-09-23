/**
 * WW_MARKS gates /api/ww/mark, the way WW_WIDGET gates /widget.
 *
 * Off by default and a 404 when off, same as the others. It is separate from
 * every other flag because this is the only route in the repo that WRITES a
 * file, and the only place it belongs is the operator's own machine during a
 * battle night. A deployment that wants the trade widget does not want this.
 */
const ON = new Set(["1", "true", "yes", "on"]);

export function marksEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.WW_MARKS;
  if (typeof raw !== "string") return false;
  return ON.has(raw.trim().toLowerCase());
}
