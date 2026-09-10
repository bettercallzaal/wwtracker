import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// `require` does not exist inside an ES module. Called there, it throws a
// ReferenceError - and if the call sits inside a try/catch, the error is
// swallowed and the feature silently does nothing.
//
// That is exactly what happened to `scripts/live-watch.mjs`: its `--notify`
// path called `require("node:child_process")` inside a try whose catch said
// "a failed notification must never take the watcher down". So from the day it
// was written until 2026-09-10, `npm run watch:live` - the command the Grand
// Final runbook tells you to use - never posted one notification. The watcher's
// own tests covered the classifier and never ran the runner.
//
// This scans every tracked .mjs file rather than naming the one that broke: a
// guard that names files is a list of what somebody remembered.

/** Code with line and block comments removed, so prose about require() passes. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** A bare require() call in ESM, unless the file builds one with createRequire. */
function usesBareRequire(src: string): boolean {
  const code = stripComments(src);
  if (/\bcreateRequire\b/.test(code)) return false;
  return /(^|[^.\w$])require\s*\(/m.test(code);
}

describe("no ES module calls require()", () => {
  it("the detector catches the defect that shipped (negative control)", () => {
    // The shape that shipped, verbatim in spirit: inside a try, so it can
    // never surface at runtime. If this stops matching, the scan below proves
    // nothing.
    const shipped = `try {\n  const { spawnSync } = require("node:child_process");\n} catch {}`;
    expect(usesBareRequire(shipped)).toBe(true);
  });

  it("does not flag prose, method calls or createRequire", () => {
    expect(usesBareRequire(`// this used to call require() here\nimport x from "y";`)).toBe(false);
    expect(usesBareRequire(`/* require("a") */ const a = 1;`)).toBe(false);
    expect(usesBareRequire(`loader.require("a");`)).toBe(false);
    expect(
      usesBareRequire(`import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nrequire("a");`),
    ).toBe(false);
  });

  it("holds across every tracked .mjs file", () => {
    const files = execSync("git ls-files '*.mjs'", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
    // An empty list would pass vacuously - the scan has to have scanned something.
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter((f) => usesBareRequire(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
