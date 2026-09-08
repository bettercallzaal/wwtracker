import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SOL_USD, SOL_USD_AS_OF, VOLUME_USD, VOLUME_SOL } from "@/lib/measured";

// One price, one definition.
//
// Until 2026-09-08 this repo had two: lib/price.ts said 101.9 and lib/measured.ts
// said 180, both stamped 2026-09-05, a 77% disagreement. The 180 was never
// measured - it was typed, in the file whose whole purpose is that figures are
// measured - and it shipped "~$167K at $180/SOL" onto the case-study page when
// the honest figure was ~$96K.
//
// Every USD figure in this repo derives from one line now, and these tests exist
// to keep it one line.

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("there is exactly one SOL price in the repo", () => {
  it("only lib/price.ts defines it", () => {
    const hits = execSync(
      "git grep -n 'export const SOL_USD *=' -- 'lib/*.ts' 'app/**/*.ts*' 'components/**/*.tsx' || true",
      { cwd: root, encoding: "utf8" },
    ).trim().split("\n").filter(Boolean);
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain("lib/price.ts");
  });

  it("measured.ts re-exports rather than redefining", () => {
    const src = readFileSync(`${root}lib/measured.ts`, "utf8");
    expect(src).toContain('export { SOL_USD, SOL_USD_AS_OF } from "./price"');
    expect(src).not.toMatch(/export const SOL_USD\s*=/);
  });
});

describe("the price is sane and dated", () => {
  it("is in a plausible band, so a typo cannot ship silently", () => {
    // 180 passed every test in this repo for a day. A band would have caught it:
    // the platform's own API reported 103.34 at the time.
    expect(SOL_USD).toBeGreaterThan(20);
    expect(SOL_USD).toBeLessThan(400);
  });

  it("carries the date it was taken", () => {
    expect(SOL_USD_AS_OF).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("derives USD rather than carrying it", () => {
    expect(VOLUME_USD).toBe(Math.round(VOLUME_SOL * SOL_USD));
  });

  it("carries a re-check date, because a price is the most perishable number here", () => {
    const src = readFileSync(`${root}lib/price.ts`, "utf8");
    expect(src).toContain("RE-CHECK BY");
  });
});

describe("the retired price cannot come back", () => {
  it("no surface quotes the 180 basis or the $167K it produced", () => {
    const hits = execSync(
      "git grep -l '\\$180/SOL\\|~\\$167K' -- app components || true",
      { cwd: root, encoding: "utf8" },
    ).trim();
    expect(hits).toBe("");
  });
});
