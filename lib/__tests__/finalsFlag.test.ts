/**
 * The gate on the live dashboard. Off unless explicitly on.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { finalsEnabled } from "../finalsFlag";

describe("the finals flag", () => {
  it("is off when unset, which is the default on every deployment", () => {
    expect(finalsEnabled({})).toBe(false);
    expect(finalsEnabled({ WW_FINALS: undefined })).toBe(false);
  });

  it("is off for anything that is not an explicit yes", () => {
    // "false" is a non-empty string. A gate that only checks for presence
    // turns WW_FINALS=false into WW_FINALS=true.
    for (const v of ["", "0", "false", "no", "off", "maybe", "FALSE "]) {
      expect(finalsEnabled({ WW_FINALS: v }), v).toBe(false);
    }
  });

  it("is on for an explicit yes, in any case or padding", () => {
    for (const v of ["1", "true", "YES", " on ", "True"]) {
      expect(finalsEnabled({ WW_FINALS: v }), v).toBe(true);
    }
  });

  it("carries no NEXT_PUBLIC_ prefix, so it never reaches a browser bundle", () => {
    // COMMENTS STRIPPED FIRST. The first version of this failed on the doc
    // comment explaining why there is no such prefix - a guard that cannot
    // tell code from prose about code.
    const src = readFileSync(new URL("../finalsFlag.ts", import.meta.url), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(src).not.toMatch(/NEXT_PUBLIC_/);
    expect(src).toMatch(/env\.WW_FINALS/);
  });
});
