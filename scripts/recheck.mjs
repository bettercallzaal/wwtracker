// Classify `RE-CHECK BY YYYY-MM-DD` markers. Pure: no file or git access, so the
// rules are testable on their own (scripts/__tests__/recheck.test.ts).
// validate.mjs does the scanning and decides what each status does to the build.
//
// Statuses:
//   ok       more than RECHECK_WARN_DAYS left
//   soon     inside RECHECK_WARN_DAYS
//   overdue  the date has passed - LOUD, but not a build failure (see below)
//   invalid  the date is not a real calendar date - a build FAILURE
//
// WHY OVERDUE DOES NOT FAIL THE BUILD (changed 2026-10-08). It used to, under
// --strict. That made main go red on a timer with no code change: a claim's
// date passing at midnight turned every open PR red, including PRs that had
// nothing to do with the claim, until someone re-measured it. The merge lead
// then needed an override to land unrelated work, and an override used every
// week is the gate switched off. Zaal ruled to fix the cause (seat, 2026-10-08).
//
// An overdue claim is still a stale claim, so it must stay somewhere a human
// reads. validate.mjs prints it, annotates it in the GitHub UI, writes it to the
// job summary, and checks.yml keeps ONE open issue listing every overdue claim
// until there are none. What it no longer does is block unrelated work.
//
// An INVALID date still fails. A marker dated 2026-13-45 parses to NaN, and NaN
// compared to anything is false, so the old code reported it "ok" forever: a
// marker that could never go overdue. That is a broken claim, not a late one.

export const RECHECK_RE = /RE-CHECK BY (\d{4}-\d{2}-\d{2})/g;
export const RECHECK_WARN_DAYS = 7;

/** True only for a real calendar date written as YYYY-MM-DD. */
function isRealDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/**
 * Every marker in `text`, with its status as of `today`.
 * @param {string} text
 * @param {string} file
 * @param {Date} today
 * @returns {{file: string, line: number, due: string, daysLeft: number | null, status: "ok" | "soon" | "overdue" | "invalid"}[]}
 */
export function classifyRechecks(text, file, today) {
  const out = [];
  for (const m of text.matchAll(RECHECK_RE)) {
    const due = m[1];
    const line = text.slice(0, m.index).split("\n").length;
    if (!isRealDate(due)) {
      out.push({ file, line, due, daysLeft: null, status: "invalid" });
      continue;
    }
    const end = new Date(`${due}T23:59:59Z`);
    const daysLeft = Math.floor((end - today) / 86400000);
    const status = daysLeft < 0 ? "overdue" : daysLeft <= RECHECK_WARN_DAYS ? "soon" : "ok";
    out.push({ file, line, due, daysLeft, status });
  }
  return out;
}

/** The issue body checks.yml posts. Empty list = no body (the issue closes). */
export function overdueReport(entries) {
  const overdue = entries.filter((e) => e.status === "overdue");
  if (overdue.length === 0) return "";
  const rows = overdue
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((e) => `| \`${e.file}:${e.line}\` | ${e.due} | ${-e.daysLeft} |`);
  return [
    `${overdue.length} time-bound claim(s) are past their re-check date.`,
    "",
    "Each one is a statement this repo makes that nobody has re-verified on time.",
    "Re-measure it and either move the date with a dated note saying what was",
    "checked, or correct the claim. See `docs/RECHECK.md`.",
    "",
    "These no longer fail the build (they used to, which turned main red on a",
    "timer). This issue is where they stay visible instead. `checks.yml` updates",
    "it on every run on main and closes it when the list is empty.",
    "",
    "| Where | Due | Days overdue |",
    "|---|---|---|",
    ...rows,
  ].join("\n");
}
