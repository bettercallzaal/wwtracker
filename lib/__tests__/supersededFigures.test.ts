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
//
// WHY THE REGISTRY IS THE GUARD THAT WORKS. On 2026-09-09 three other guards in
// this repo passed while the thing they guarded was wrong, each because it named
// the files it checked: feeRates.test.ts listed three surfaces and the fee model
// was not one of them; duneTransposition.test.ts asserted the mapping inside one
// of the two objects ww-gen.mjs emits; the launch-fee measurement was written in
// eighteen lines of prose twenty lines above the function that ignored it.
//
// A list of files is a list of what somebody remembered. A list of VALUES is
// not - it fails wherever the value turns up. That is why retired figures are
// added here rather than to a per-file check.

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
  // Retired 2026-09-09. Seven defects that day were all the same shape - a
  // correction reaching one consumer and not another - so every value each one
  // retired goes in the registry, which is the only guard here that does not
  // care which file the value reappears in.
  ["1.0% of trade", "1.500% split 67/33, so 1.005% to the artist"],
  ["0.5% of trade", "1.500% split 67/33, so 0.495% to the platform"],
  ["0.5% of every trade", "0.495% of every trade"],
  ["1% of volume", "1.005% of volume"],
  ["1% of trading volume", "1.005% of trading volume"],
  ["13,055", "12,408 trades - 13,055 was buys + CLAIMS, from the transposed file"],
  ["2.83 buys per sell", "3.49 buys per sell"],
  ["1.72 claims per settled", "2.13 claims per settled battle"],
  ["2,762 claims", "3,409 claims - 2,762 is the SELL count"],
  ["1,052.879", "platform revenue is trade fees only; launch fees are not collected"],
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

/**
 * Blank out comment bodies, keeping line structure.
 *
 * The check used to ask whether a LINE STARTS with a comment marker, which is
 * true of `// foo` and false of the second line of
 *
 *   {/* the launch fees put 1,052.879 SOL
 *       on the page * /}
 *
 * so a multi-line explanation of a retired value tripped the guard that
 * explanation exists to support. That pressure is worth removing: the way a
 * false positive gets resolved at 2am is by deleting the registry entry, and
 * then the guard is gone rather than noisy.
 *
 * A string literal containing the characters that open a block comment would be
 * blanked too. That is a false negative on one line, which is the safe
 * direction, and no surface in this repo has one.
 */
function commentsBlanked(src: string): string {
  let out = "";
  let inBlock = false;
  for (const line of src.split("\n")) {
    let kept = "";
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf("*/", i);
        if (end === -1) { i = line.length; break; }
        inBlock = false;
        i = end + 2;
        continue;
      }
      const block = line.indexOf("/*", i);
      const lineC = line.indexOf("//", i);
      if (lineC !== -1 && (block === -1 || lineC < block)) { kept += line.slice(i, lineC); break; }
      if (block !== -1) { kept += line.slice(i, block); inBlock = true; i = block + 2; continue; }
      kept += line.slice(i);
      break;
    }
    out += kept + "\n";
  }
  return out;
}

// A placeholder in a plain string ships as literal text.
//
// Introduced and caught on 2026-09-09: converting the case study's revenue
// answer to derive from lib/measured put `${M.QUEUE_FEES_SOL}` inside a
// DOUBLE-QUOTED string, so the page rendered the characters instead of the
// number - in the FAQ block, which is also emitted as JSON-LD and scraped into
// search results.
//
// typecheck passed. 494 tests passed. A string containing `${` is valid
// TypeScript; nothing but rendering the page could see it. This is the cheap
// version of rendering the page.
/** Blank the body of every backtick template, keeping line structure. */
function templatesBlanked(src: string): string {
  let out = "";
  let inTemplate = false;
  for (const ch of src) {
    if (ch === "\n") { out += ch; continue; }
    if (ch === "`") { inTemplate = !inTemplate; out += " "; continue; }
    out += inTemplate ? " " : ch;
  }
  return out;
}

describe("no placeholder ships as literal text", () => {
  const files = [...surfaceFiles("app"), ...surfaceFiles("components"), ...surfaceFiles("lib")];

  it("has no ${...} inside a single- or double-quoted string", () => {
    for (const f of files) {
      if (f.includes("__tests__")) continue;
      const src = templatesBlanked(commentsBlanked(readFileSync(`${root}${f}`, "utf8")));
      for (const [i, line] of src.split("\n").entries()) {
        // Quoted runs only, and only OUTSIDE a backtick template. A template
        // may legitimately contain `"${kind}"` - the quotes are part of the
        // message, the placeholder still interpolates. Scanning before blanking
        // templates flagged exactly that in the leaderboards route.
        for (const m of line.matchAll(/"[^"\n]*"|'[^'\n]*'/g)) {
          if (!m[0].includes("${")) continue;
          expect({ file: f, line: i + 1, text: m[0].slice(0, 60), literalPlaceholder: true })
            .toEqual({ file: f, line: i + 1, text: m[0].slice(0, 60), literalPlaceholder: false });
        }
      }
    }
  });
});

describe("retired figures cannot return to a rendered surface", () => {
  const files = [...surfaceFiles("app"), ...surfaceFiles("components")];

  it("finds surfaces at all, so this cannot pass by finding nothing", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("carries no superseded value in app/ or components/", () => {
    for (const f of files) {
      const src = commentsBlanked(readFileSync(`${root}${f}`, "utf8"));
      for (const [bad, replacement] of SUPERSEDED) {
        for (const line of src.split("\n")) {
          if (!line.includes(bad)) continue;
          expect({ file: f, bad, replacement, rendered: true })
            .toEqual({ file: f, bad, replacement, rendered: false });
        }
      }
    }
  });
});
