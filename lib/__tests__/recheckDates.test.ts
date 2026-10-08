import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Time-bound claims go stale silently. The estate counted five in a single day
// on 2026-09-08 - a protocol recorded as live that was not, an application
// against a closed cycle, a VPS marked down that had been up sixteen days, doc
// summaries contradicting their own bodies, superseded pages marked as nothing.
//
// The convention was "write a re-check date next to the claim". Written down,
// that is honor-system, and the measured estate figures are 3-40% for
// honor-system rules against ~100% for structurally enforced ones. So
// scripts/validate.mjs enforces it and CI runs --strict.
//
// Changed 2026-10-08: an overdue claim is LOUD but no longer a build failure
// (it turned main red on a timer with no code change). The behavior itself is
// tested end to end in scripts/__tests__/recheck.test.ts; these guard that the
// loud half was not quietly dropped along with the failure.
//
// These tests guard the enforcement itself, because a gate nobody invokes is not
// a gate - which this repo has already learned once.

const root = fileURLToPath(new URL("../../", import.meta.url));
const validate = readFileSync(`${root}scripts/validate.mjs`, "utf8");

describe("re-check dates are enforced, not trusted", () => {
  it("the validator scans for the marker and keeps an overdue claim loud", () => {
    expect(validate).toContain("RE-CHECK BY");
    expect(validate).toContain("OVERDUE");
    // This used to assert that past due was a failure under --strict. That was
    // the rule until 2026-10-08. Now past due must reach a human three ways:
    // a GitHub annotation, the job summary, and the report checks.yml turns
    // into the one open issue.
    expect(validate).toContain("::warning file=");
    expect(validate).toContain("GITHUB_STEP_SUMMARY");
    expect(validate).toContain("--recheck-report");
    const checks = readFileSync(`${root}.github/workflows/checks.yml`, "utf8");
    expect(checks).toContain("--recheck-report");
    expect(checks).toContain('TITLE="Overdue RE-CHECK claims"');
  });

  it("a marker with an impossible date fails, because it could never go overdue", () => {
    expect(validate).toMatch(/status === "invalid"\) \{\s*bad\(/);
  });

  it("warns when it finds no markers at all", () => {
    // A repo with zero dated claims is far likelier to have dropped the
    // convention than to genuinely have none, so silence is not a pass.
    expect(validate).toContain("the convention has probably been dropped");
  });

  it("does not match its own regex literal", () => {
    // The validator contains the marker string by necessity. If it scanned
    // itself it would report a phantom claim with an unparseable date.
    expect(validate).toContain('f === "scripts/validate.mjs"');
  });
});

describe("the claims registry exists and is dated", () => {
  const registry = readFileSync(`${root}docs/RECHECK.md`, "utf8");

  it("carries at least one live marker", () => {
    const found = [...registry.matchAll(/RE-CHECK BY (\d{4}-\d{2}-\d{2})/g)];
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  it("names the disclosed key, which is the claim with real money behind it", () => {
    expect(registry).toContain("deliberately not rotated");
    expect(registry).toMatch(/second.{0,40}key/i);
  });

  it("every marker in the repo parses as a real date", () => {
    const files = execSync("git ls-files", { cwd: root, encoding: "utf8" }).trim().split("\n");
    let checked = 0;
    for (const f of files) {
      if (!/\.(md|ts|tsx|mjs|js|sh)$/.test(f)) continue;
      let text: string;
      try { text = readFileSync(`${root}${f}`, "utf8"); } catch { continue; }
      for (const m of text.matchAll(/RE-CHECK BY (\d{4}-\d{2}-\d{2})/g)) {
        checked++;
        expect(Number.isNaN(Date.parse(m[1]))).toBe(false);
      }
    }
    // Non-vacuous: if this ever finds nothing, the convention is gone.
    expect(checked).toBeGreaterThan(0);
  });
});
