/**
 * The first flag on the line must not be dropped.
 *
 * `ww-45s-report.ts --marks FILE` silently read a different file, because the
 * parser tested `i > 0` against an array that had already had the node binary
 * and the script name sliced off. The measurement it exists for had never been
 * run successfully, so nothing had ever caught it.
 */
import { describe, expect, it } from "vitest";
import { hasFlag, optionValue } from "../cliArgs";

describe("optionValue", () => {
  it("reads a flag in FIRST position, which is the case that was broken", () => {
    expect(optionValue(["--marks", "/tmp/a.log"], "--marks", "default")).toBe("/tmp/a.log");
  });

  it("reads it anywhere else too", () => {
    expect(optionValue(["1789948124", "--marks", "/tmp/a.log"], "--marks", "d")).toBe("/tmp/a.log");
    expect(optionValue(["--store", "var", "--marks", "/tmp/a.log"], "--marks", "d")).toBe("/tmp/a.log");
  });

  it("falls back only when the flag is genuinely absent", () => {
    expect(optionValue(["--store", "var"], "--marks", "default")).toBe("default");
    expect(optionValue([], "--marks", "default")).toBe("default");
    expect(optionValue([], "--marks")).toBeUndefined();
  });

  /**
   * A flag with no value is a typo, and answering it with the default is how
   * the original failure read as a choice rather than a mistake.
   */
  it("throws when a flag has no value, rather than quietly defaulting", () => {
    expect(() => optionValue(["--marks"], "--marks", "d")).toThrow(/--marks needs a value/);
    expect(() => optionValue(["--marks", "--store", "var"], "--marks", "d")).toThrow(/needs a value/);
  });

  it("hasFlag sees a flag in first position", () => {
    expect(hasFlag(["--dry-run"], "--dry-run")).toBe(true);
    expect(hasFlag(["x", "--dry-run"], "--dry-run")).toBe(true);
    expect(hasFlag(["x"], "--dry-run")).toBe(false);
  });
});
