import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Superseded figures must not come back to a rendered surface.
//
// This is not hypothetical. #241 corrected the fee rates and the dated figures
// in the case-study FAQ; #243 existed only because the CITABLE_FACTS block in
// the same file still carried the old ones. Then #244 rewired the Dataset schema
// in app/layout.tsx to derive from lib/measured, and the site description and
// both social cards - three fields in the SAME FILE - kept "1,500+ battles,
// 921+ SOL" until 2026-09-08. Those are the highest-reach strings on the site:
// a meta description is what search results and every link preview show.
//
// The pattern each time was fixing one part of a file and missing its siblings.
// A registry of retired values closes that, because it does not care which file
// or which sibling - the value simply cannot appear on a surface again.
//
// SCOPE: rendered surfaces only, app/ and components/. lib/wwData.ts legitimately
// holds 921.4852 as the Dune series total, and docs/UPSTREAM-STATS-API.md quotes
// upstream's own sample payload. Neither is our claim about the platform.

const root = fileURLToPath(new URL("../../", import.meta.url));

/** Value, and what replaced it - the message a failure should print. */
const SUPERSEDED: Array<[string, string]> = [
  ["1,500+", "1,643 battle accounts on chain, or 1,501 returned by the public API"],
  ["921+ SOL", "928.21 SOL, measured from the complete scan"],
  ["1,291+", "1,643"],
  ["878+ SOL", "928.21 SOL"],
  ["13.39 SOL", "13.94 SOL, all legs"],
  ["20.06 SOL", "19.34 SOL of platform revenue"],
  ["2.28% effective fee rate", "the three revenue lines, which behave differently"],
  ["1.53% artist payout rate", "1.005% per trade plus settlement bonuses"],
  ["1% of every trade", "1.005% of every trade"],
  ["1% per trade", "1.005% of every trade"],
];

function surfaceFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(`${root}${dir}`, { withFileTypes: true })) {
    if (e.name === "__tests__" || e.name === "node_modules") continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) surfaceFiles(rel, acc);
    else if (/\.(ts|tsx)$/.test(e.name)) acc.push(rel);
  }
  return acc;
}

describe("retired figures cannot return to a rendered surface", () => {
  const files = [...surfaceFiles("app"), ...surfaceFiles("components")];

  it("finds surfaces at all, so this cannot pass by finding nothing", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("carries no superseded value in app/ or components/", () => {
    for (const f of files) {
      const src = readFileSync(`${root}${f}`, "utf8");
      for (const [bad, replacement] of SUPERSEDED) {
        // Comments explaining what was retired are allowed; the value appearing
        // in a rendered string is not. Lines mentioning the fix are exempt.
        for (const line of src.split("\n")) {
          if (!line.includes(bad)) continue;
          const isComment = /^\s*(\/\/|\*|\/\*)/.test(line);
          expect({ file: f, bad, replacement, renderedNotComment: !isComment })
            .toEqual({ file: f, bad, replacement, renderedNotComment: false });
        }
      }
    }
  });
});
