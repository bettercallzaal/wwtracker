/**
 * WW_LAUNCH gates /launch and the relay's willingness to forward a launch.
 *
 * Off by default, 404 when off, same shape as WW_WIDGET and WW_OPERATOR.
 * Separate from all of them because creating a battle is a different act from
 * trading one or settling one, and a deployment can want any without the rest.
 */
const ON = new Set(["1", "true", "yes", "on"]);

export function launchEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = env.WW_LAUNCH;
  if (typeof raw !== "string") return false;
  return ON.has(raw.trim().toLowerCase());
}
