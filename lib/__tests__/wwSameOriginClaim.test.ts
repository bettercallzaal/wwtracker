/**
 * A control we do not have must not be written down as if we do.
 *
 * Seven route files and docs/PUBLIC-API.md said "Same-origin only" about
 * endpoints that spend a keyed RPC per request. There is no origin check in
 * this codebase: on 2026-09-22 `grep -rn 'headers.get("origin")' app lib`
 * returned nothing, and the deployed /api/ww/claimable answered an anonymous
 * curl carrying `Origin: https://evil.example` with 200 and a full position
 * list for the wallet it was asked about.
 *
 * The real protection is the ABSENCE OF CORS HEADERS, which stops another
 * website's JavaScript from READING the response and stops nothing else: curl,
 * a server, or a script has never needed CORS. That is a reasonable design for
 * data that is public on chain anyway, and it is not what "same-origin only"
 * says to a reader deciding whether to put something behind it.
 *
 * These two tests keep the words and the code together, in both directions.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const API = join(process.cwd(), "app", "api", "ww");
const routeFiles = readdirSync(API, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => join(API, e.name, "route.ts"))
  .filter((p) => {
    try { readFileSync(p); return true; } catch { return false; }
  });

const sources = routeFiles.map((p) => ({ path: p.slice(process.cwd().length + 1), text: readFileSync(p, "utf8") }));

describe("the same-origin claim matches the code", () => {
  it("has routes to check at all", () => {
    // Without this, an empty glob would make both tests below vacuously pass.
    expect(sources.length).toBeGreaterThan(5);
  });

  /**
   * A bare "same-origin only" reads as a server-side restriction. Where a file
   * says it, it must also name the mechanism, so nobody plans around a check
   * that is not there.
   */
  it("never claims same-origin without naming CORS as the mechanism", () => {
    const offenders = sources
      .filter((s) => /same-origin/i.test(s.text))
      .filter((s) => !/CORS/.test(s.text))
      .map((s) => s.path);
    expect(offenders).toEqual([]);
  });

  /**
   * The other direction. If somebody adds a real origin check, this fails and
   * the prose above has to be revisited deliberately - at which point "same
   * origin only" may become true and should be written plainly again.
   */
  it("still has no server-side origin check, which is what the prose now says", () => {
    const withCheck = sources.filter((s) => /headers\s*\.\s*get\(\s*["'`][Oo]rigin["'`]\s*\)/.test(s.text)).map((s) => s.path);
    expect(withCheck).toEqual([]);
  });
});
