import { spawnSync } from "node:child_process";
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

  it("lists stale datasets too, and is non-empty on stale data alone", () => {
    const r = overdueReport([], [{ label: "public/a.json", age: 60, newest: "2026-08-10", note: "parking expired 2026-10-15" }]);
    expect(r).toContain("1 dataset(s) stale past 45 days");
    expect(r).toContain("| `public/a.json` | 2026-08-10 | 60 | parking expired 2026-10-15 |");
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

describe("validate.mjs --strict", () => {
  it("an overdue re-check date warns loudly and does not fail the build", () => {
    // lib/price.ts carries a claim due 2026-10-08. One day later it is overdue.
    const { code, out } = validate("2026-10-09");
    expect(out).toMatch(/OVERDUE lib\/price\.ts:\d+: claim due for re-check 2026-10-08/);
    expect(out).toMatch(/\d+ OVERDUE re-check claim\(s\)/);
    expect(code).toBe(0);
  });

  it("stale data a year on is loud and listed, and does not fail the build", () => {
    // Until 2026-10-08 this was the red control: a year out, stale data FAILED.
    // Staleness is now timer-driven and loud rather than a failure, so the red
    // control is the wrong-date case below.
    const { code, out } = validate("2027-10-09");
    expect(out).toMatch(/STALE public\/ww-battles\.json: \d+ days old/);
    expect(out).toMatch(/STALE public\/ww-skips\.json: .* parking expired 2026-10-15/);
    expect(out).toMatch(/\d+ STALE dataset\(s\) above/);
    expect(code).toBe(0);
  });

  it("red control: a dataset dated after today is a wrong figure and still fails", () => {
    // As of 2026-01-01 every baked dataset's newest record is months in the
    // future. Waiting cannot fix that; the date or the clock is wrong.
    const { code, out } = validate("2026-01-01");
    expect(out).toMatch(/FAIL public\/ww-battles\.json: newest record .* in the future - the date is wrong/);
    expect(out).toContain("VALIDATION FAILED");
    expect(code).toBe(1);
  });

  it("refuses a malformed VALIDATE_TODAY instead of ignoring it", () => {
    const { code, out } = validate("tomorrow");
    expect(out).toContain("FAIL VALIDATE_TODAY=tomorrow");
    expect(code).toBe(1);
  });
});
