/**
 * Every script is named in docs/SCRIPTS.md.
 *
 * There were twenty-seven scripts and no index of them until 2026-09-23. That
 * is not a tidiness problem: two of the three tools a battle night depends on
 * were broken for days because they run once a week, nothing else exercises
 * them, and the procedure that uses them did not name them. Three more tools
 * were written the same day and none reached the procedure either, which is
 * how the first version of this index came to be written at all.
 *
 * An index maintained by remembering is an index that goes stale. This fails
 * the build instead.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SCRIPTS = join(process.cwd(), "scripts");
const INDEX = join(process.cwd(), "docs", "SCRIPTS.md");

const scripts = readdirSync(SCRIPTS).filter((f) => /\.(ts|sh|mjs)$/.test(f)).sort();
const index = readFileSync(INDEX, "utf8");

describe("docs/SCRIPTS.md", () => {
  it("has scripts to check, so an empty directory cannot pass this vacuously", () => {
    expect(scripts.length).toBeGreaterThan(20);
  });

  it("names every script in scripts/", () => {
    const missing = scripts.filter((f) => !index.includes(`\`${f}\``));
    expect(missing).toEqual([]);
  });

  /**
   * The other direction: a script that is deleted should not keep a row that
   * sends somebody looking for a file that is gone.
   */
  it("names no script that does not exist", () => {
    const named = [...index.matchAll(/`([\w.-]+\.(?:ts|sh|mjs))`/g)].map((m) => m[1]);
    const ghosts = [...new Set(named)].filter((f) => !scripts.includes(f));
    expect(ghosts).toEqual([]);
  });
});
