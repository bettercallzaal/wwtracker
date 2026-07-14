const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Converts a "Mon D, YYYY" display date (as stored in public/ww-battles.json)
 * to an ISO "YYYY-MM-DD" string. Returns null if the input doesn't match. */
export function toIsoDate(display: string): string | null {
  const m = display.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const [, mon, day, year] = m;
  const mm = MONTHS[mon];
  if (!mm) return null;
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}
