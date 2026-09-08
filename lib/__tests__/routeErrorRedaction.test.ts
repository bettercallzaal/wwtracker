import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// No route may put raw error text into a response body.
//
// /api/ww/positions leaked the keyed RPC URL through its `source` field, and the
// error path was the same leak by a slower route: Node's fetch throws
// "Failed to parse URL from <input>", and <input> was the env var's value. Every
// field a route builds can be careful while err.message hands back the endpoint
// it failed against.
//
// Fixing that one route fixed one instance. Five other routes echoed err.message
// unredacted, and the next route somebody writes would have made six. This makes
// the class impossible instead: the guard fails the build on any route that
// reaches a response with error text that has not been through redactSecrets.
//
// The routes are not equally exposed today - Dune and Anthropic take their keys
// in headers rather than URLs - but "not exploitable this week" is not a
// property worth relying on, and it is one env-var-in-a-URL away from being the
// same bug.

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Walk the filesystem, NOT `git ls-files`.
 *
 * The first version of this guard used git, and a probe route written to catch
 * it sailed straight through - because a brand-new route is untracked until it
 * is committed, and a brand-new route is the exact case this exists to catch.
 * A guard that only sees code already in the repo cannot stop code being added.
 */
function routeFiles(dir = "app/api", acc: string[] = []): string[] {
  for (const entry of readdirSync(`${root}${dir}`, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) routeFiles(rel, acc);
    else if (entry.name === "route.ts") acc.push(rel);
  }
  return acc;
}

describe("no route leaks raw error text to a caller", () => {
  const files = routeFiles();

  it("finds routes at all, so this cannot pass by finding nothing", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it("routes every error message through redactSecrets", () => {
    for (const f of files) {
      const src = readFileSync(`${root}${f}`, "utf8");
      // Every occurrence of the `X instanceof Error ? X.message` idiom must sit
      // inside a redactSecrets(...) call on the same line.
      for (const line of src.split("\n")) {
        if (!/instanceof Error \? .*\.message/.test(line)) continue;
        expect({ file: f, line: line.trim().slice(0, 90), redacted: line.includes("redactSecrets(") })
          .toEqual({ file: f, line: line.trim().slice(0, 90), redacted: true });
      }
    }
  });

  it("never interpolates a process.env value straight into a response", () => {
    // The original defect in one line: `source: RPC` where RPC was the keyed URL.
    for (const f of files) {
      const src = readFileSync(`${root}${f}`, "utf8");
      expect({ file: f, leaks: /(?:source|error|message|note)\s*:\s*process\.env\./.test(src) })
        .toEqual({ file: f, leaks: false });
    }
  });
});

describe("redactSecrets actually removes what it claims to", () => {
  it("collapses a keyed URL wherever it appears in a message", async () => {
    const { redactSecrets } = await import("@/lib/redact");
    const msg = "Failed to parse URL from https://mainnet.helius-rpc.com/?api-key=abc123DEF";
    const out = redactSecrets(msg);
    expect(out).not.toContain("abc123DEF");
    expect(out).not.toContain("api-key=");
    expect(out).toContain("mainnet.helius-rpc.com");
  });
});
