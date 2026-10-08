import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyRechecks, overdueReport } from "../recheck.mjs";

// The marker is spelled in pieces so this file never carries a real one.
const MARK = ["RE-CHECK", "BY"].join(" ");
const today = new Date("2026-10-09T12:00:00Z");

describe("classifyRechecks", () => {
  it.each([
    ["2026-12-01", "ok"],
    ["2026-10-12", "soon"],
    ["2026-10-09", "soon"],
    ["2026-10-08", "overdue"],
    ["2026-09-01", "overdue"],
    ["2026-13-45", "invalid"],
    ["2026-02-30", "invalid"],
  ])("%s is %s", (due, status) => {
    const [e] = classifyRechecks(`x\n// ${MARK} ${due}\n`, "f.ts", today);
    expect(e.status).toBe(status);
    expect(e.line).toBe(2);
  });

  it("finds every marker in a file", () => {
    const text = `${MARK} 2026-12-01\n${MARK} 2026-09-01\n`;
    expect(classifyRechecks(text, "f.md", today).map((e: { status: string }) => e.status)).toEqual(["ok", "overdue"]);
  });
});

describe("overdueReport", () => {
  it("is empty when nothing is overdue, so the issue can close", () => {
    expect(overdueReport(classifyRechecks(`${MARK} 2026-12-01`, "f.ts", today))).toBe("");
  });

  it("lists each overdue claim with where and how late", () => {
    const r = overdueReport(classifyRechecks(`\n${MARK} 2026-10-01`, "lib/x.ts", today));
    expect(r).toContain("| `lib/x.ts:2` | 2026-10-01 | 8 |");
  });
});

// The whole validator, run as CI runs it, against the real repo. Both
// directions: the timer case must not fail, and a real failure still must.
function validate(asOf: string) {
  const r = spawnSync("node", ["scripts/validate.mjs", "--strict"], {
    encoding: "utf8",
    env: { ...process.env, VALIDATE_TODAY: asOf, GITHUB_ACTIONS: "", GITHUB_STEP_SUMMARY: "" },
  });
  return { code: r.status, out: r.stdout };
}

// The earliest real marker in the repo, so the test follows the claims instead
// of pinning one. It first pinned lib/price.ts's 2026-10-08 date, and went red
// on the PR that re-measured the price and moved that date (#435).
function earliestMarker(): { file: string; due: string } {
  const skip = new Set(["scripts/validate.mjs", "scripts/recheck.mjs", "scripts/__tests__/recheck.test.ts"]);
  const files = execSync("git ls-files", { encoding: "utf8" }).trim().split("\n");
  let best: { file: string; due: string } | null = null;
  for (const f of files) {
    if (skip.has(f) || !/\.(md|ts|tsx|mjs|js|sh|json|yml)$/.test(f)) continue;
    let text: string;
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    for (const e of classifyRechecks(text, f, today)) {
      if (e.status !== "invalid" && (!best || e.due < best.due)) best = { file: f, due: e.due };
    }
  }
  if (!best) throw new Error("no RE-CHECK markers in the repo - the convention is gone");
  return best;
}

describe("validate.mjs --strict", () => {
  it("an overdue re-check date warns loudly and is never itself a failure", () => {
    // The day after the earliest claim falls due, that claim is overdue.
    const { file, due } = earliestMarker();
    const dayAfter = new Date(Date.parse(`${due}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const { code, out } = validate(dayAfter);
    const esc = file.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    expect(out).toMatch(new RegExp(`OVERDUE ${esc}:\\d+: claim due for re-check ${due}`));
    expect(out).toMatch(/\d+ OVERDUE re-check claim/);
    // No re-check line may be a FAIL. Other date checks (dataset staleness)
    // can legitimately fail on some future day, so the exit code is only
    // asserted when nothing else failed.
    expect(out).not.toMatch(/FAIL .*claim due for re-check/);
    if (!/^\s*FAIL /m.test(out)) expect(code).toBe(0);
  });

  it("a genuinely failing check still fails: stale data a year on", () => {
    // Red control. Nothing about the re-check change may turn a real failure
    // green. A year out, the baked datasets are far past STALE_DAYS.
    const { code, out } = validate("2027-10-09");
    expect(out).toMatch(/FAIL .*days old/);
    expect(out).toContain("VALIDATION FAILED");
    expect(code).toBe(1);
  });

  it("refuses a malformed VALIDATE_TODAY instead of ignoring it", () => {
    const { code, out } = validate("tomorrow");
    expect(out).toContain("FAIL VALIDATE_TODAY=tomorrow");
    expect(code).toBe(1);
  });
});
