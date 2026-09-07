import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// docs/PUBLIC-API.md is a contract published to third parties who embed these
// endpoints. It drifted the same way the figures did: two endpoints shipped
// undocumented, and its closing line claimed everything proxies wavewarz.info
// after /api/ww/positions started reading Solana directly.
//
// A doc that is wrong about a public contract is worse than no doc, because a
// consumer builds against it. So the drift is a failing test now.

const root = fileURLToPath(new URL("../../", import.meta.url));
const doc = readFileSync(join(root, "docs/PUBLIC-API.md"), "utf8");

/** Every route segment under app/api/ww, including dynamic ones. */
function routeSegments(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    const path = `${prefix}/${entry}`;
    if (readdirSync(full).includes("route.ts")) out.push(path);
    out.push(...routeSegments(full, path));
  }
  return out;
}

describe("the published API contract covers what is actually served", () => {
  const routes = routeSegments(join(root, "app/api/ww"));

  it("finds the routes at all, so this cannot pass by finding nothing", () => {
    expect(routes.length).toBeGreaterThanOrEqual(4);
  });

  it("documents every /api/ww route that exists", () => {
    for (const r of routes) {
      // Dynamic segments are documented in their brace form, e.g. {kind}.
      const documented = r.replace(/\[(\w+)\]/g, "{$1}");
      expect({ route: r, documented: doc.includes(`/api/ww${documented}`) }).toEqual({
        route: r, documented: true,
      });
    }
  });

  it("does not claim every endpoint proxies wavewarz.info", () => {
    // False since positions started reading Solana directly.
    expect(doc).not.toContain("Everything here proxies");
    expect(doc).toContain("positions` is the exception");
  });

  it("warns about the trader leaderboard rather than shipping it unqualified", () => {
    // Every numeric field on a trader row comes off a table measured at 43%
    // complete by value. A consumer must be told before they render it.
    expect(doc).toContain("netPnlSol");
    expect(doc).toContain("45 of the 145");
    expect(doc).toMatch(/Only `wallet` is safe/);
  });

  it("documents the truncation flags, since they change the arithmetic", () => {
    expect(doc).toContain("truncatedA");
    expect(doc).toContain("truncatedB");
    // The specific inference the flag invalidates.
    expect(doc).toContain("supplyA - heldA");
  });

  it("says source is an origin, never a full URL", () => {
    expect(doc).toContain("origin only");
  });
});
