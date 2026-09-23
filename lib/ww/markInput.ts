/**
 * Accepting a mark from somewhere other than a dedicated terminal.
 *
 * WHY. `scripts/ww-mark.sh` has worked since 2026-09-21 and `ww-night.sh
 * rehearse` exercises it every time. FIVE scheduled sessions have now passed
 * and `~/zao-vault/projects/` holds no `ww-45s-marks-*.log` at all. The tool is
 * not broken; the step is. It asks the operator to keep a SECOND terminal
 * focused and type into it at the exact moment the host speaks, while they are
 * also trading and listening - and the page they are actually looking at,
 * `/battle/latest`, has no way to record anything.
 *
 * Five failures of the same step is a property of the step. So a mark can now
 * come from the page that is already open, and this module is the part that
 * decides what is acceptable to write.
 *
 * THIS IS INPUT FROM A REQUEST AND IT IS TREATED AS SUCH. The marks file is
 * append-only text that a later report parses by line, so a label carrying a
 * newline would forge additional marks with times nobody recorded, and one
 * carrying a path separator would be an invitation to build a filename out of
 * it. Labels are therefore restricted to a short lowercase token rather than
 * sanitised, because a filter that strips the bad characters has to be right
 * about all of them and an allowlist only has to be right about the good ones.
 */

/** The longest label worth writing. `announce` and `sent` are the real ones. */
export const MAX_LABEL_LENGTH = 32;

/** Lowercase letters, digits and hyphens. Nothing that can end a line or a path. */
const LABEL = /^[a-z0-9-]{1,32}$/;

export type MarkAccepted = { ok: true; label: string };
export type MarkRejected = { ok: false; reason: string };

/**
 * Normalise and check a label from a request.
 *
 * Trimming and lowercasing happen BEFORE the test, so "Announce " is accepted
 * as `announce` rather than refused for a capital and a space the operator
 * cannot see. Everything else is refused with the reason, because a mark that
 * silently did not record is the failure this whole module exists to end.
 */
export function acceptMarkLabel(raw: unknown): MarkAccepted | MarkRejected {
  if (typeof raw !== "string") return { ok: false, reason: "label must be a string" };
  const label = raw.trim().toLowerCase();
  if (label.length === 0) return { ok: false, reason: "label is empty" };
  if (label.length > MAX_LABEL_LENGTH) {
    return { ok: false, reason: `label longer than ${MAX_LABEL_LENGTH} characters` };
  }
  if (!LABEL.test(label)) {
    return { ok: false, reason: "label may contain only lowercase letters, digits and hyphens" };
  }
  return { ok: true, label };
}

/**
 * The line to append, in the exact format `parseMarkLine` reads.
 *
 * The timestamp is passed in rather than taken here, so the caller stamps it
 * from the clock in the same operation that writes the line - the standing rule
 * for anything that will be read later - and so this stays testable without
 * freezing a clock.
 */
export function markLine(stamp: Date, label: string): string {
  const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");
  const offsetMinutes = -stamp.getTimezoneOffset();
  const sign = offsetMinutes < 0 ? "-" : "+";
  const offset = `${sign}${pad(Math.floor(Math.abs(offsetMinutes) / 60))}${pad(Math.abs(offsetMinutes) % 60)}`;
  const iso =
    `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}` +
    `T${pad(stamp.getHours())}:${pad(stamp.getMinutes())}:${pad(stamp.getSeconds())}${offset}`;
  return `${iso} ${label}\n`;
}

/** Today's marks file, by the same rule `scripts/ww-mark.sh` uses. */
export function marksFileName(stamp: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `ww-45s-marks-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}.log`;
}
