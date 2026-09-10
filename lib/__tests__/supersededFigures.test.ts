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
  // Retired 2026-07-31 by Zaal: "no longer working with magnetiq please do not
  // reference it again or songjam". SANG was defined only as SongJam's token,
  // so naming it names them. Still rendered in AboutWaveWarZ's ecosystem list
  // until 2026-09-10. Names rather than figures, but the same failure: a value
  // that was retired and kept rendering.
  ["SongJam", "nothing - SongJam is retired, do not reference it"],
  ["(SANG)", "nothing - SANG was SongJam's token"],
  ["Magnetiq", "nothing - Magnetiq is retired, do not reference it"],
  // Typed, never measured; shipped a 74% overstatement onto the case study.
  ["SOL_USD = 180", "the measured price - zao-measure --verify \"wwtracker: SOL price basis\""],
  ["1,500+", "1,643 battle accounts on chain, or 1,501 returned by the public API"],
  ["921+ SOL", "928.52 SOL, measured from the complete scan"],
  ["1,291+", "1,643"],
  ["878+ SOL", "928.52 SOL"],
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
  ["13,055", "11,980 trades - 13,055 was buys + CLAIMS, from the transposed file"],
  ["2.83 buys per sell", "3.48 buys per sell"],
  ["1.72 claims per settled", "2.12 claims per settled battle"],
  ["2,762 claims", "3,392 claims - 2,762 is the SELL count"],
  ["1,052.879", "platform revenue is trade fees only; launch fees are not collected"],
  // Retired 2026-09-10. The Dune series counts failed transactions; these are
  // the figures it produced once the transposition was undone, each carrying
  // failed attempts as if they had happened.
  ["12,408", "11,980 trades - 12,408 counted 428 failed attempts"],
  ["9,646", "9,307 buys - 9,646 counted 339 failed"],
  ["3,409", "3,392 claims - the rest of 3,409 were failed attempts"],
  ["3.49 buys per sell", "3.48 buys per sell"],
  ["2.13 claims per settled", "2.12 claims per settled battle"],
  // Retired 2026-09-10. The "complete" scan was 1,642 of 1,643 battles - one
  // held a DNS error recorded as done (wavewarz-protocol #11).
  ["928.21", "928.52 SOL - 928.21 was one battle short"],
  ["11,968", "11,980 trades - 11,968 was one battle short"],
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

// Docs, too. On 2026-09-10 docs/REFRESH.md told the reader to type
// `SOL_USD = 180` - the figure retired two days earlier after it overstated the
// case study by 74% - and docs/WAVEWARZ-RESEARCH.md still gave the fee split as
// 1.0 / 0.5 a day after every rendered surface was corrected. A refresh doc is
// where a retired value gets re-typed from, and the rendered-code scan above
// could not see either.
//
// Docs legitimately name retired values when explaining a correction, with the
// old number next to the new one. So this fails CLOSED with a counted exemption
// list: each (file, value) pair below is allowed up to its count, with a
// reason. Any new occurrence - a new file, or one more in an exempt file -
// fails until someone adds it here and says why.
const DOC_EXEMPT: Record<string, { max: number; why: string }> = {
  "docs/ARCHITECTURE.md|13,055": { max: 1, why: "history of the transposition fix, old beside new" },
  "docs/ARCHITECTURE.md|1.72 claims per settled": { max: 1, why: "history of the transposition fix" },
  "docs/ARCHITECTURE.md|2,762 claims": { max: 1, why: "history of the transposition fix" },
  "docs/ARCHITECTURE.md|12,408": { max: 1, why: "history of the failed-attempt fix" },
  "docs/ARCHITECTURE.md|9,646": { max: 2, why: "Dune's own count, labelled as such beside the chain's" },
  "docs/ARCHITECTURE.md|3,409": { max: 2, why: "Dune's own count, labelled as such beside the chain's" },
  "docs/AUDIT.md|12,408": { max: 1, why: "the finding that retired it" },
  "docs/AUDIT.md|928.21": { max: 1, why: "the snapshot-hole finding that retired it" },
  "docs/AUDIT.md|9,646": { max: 2, why: "Dune-vs-chain comparison tables in 3.8" },
  "docs/AUDIT.md|3,409": { max: 2, why: "Dune-vs-chain comparison tables in 3.8" },
  "docs/AUDIT.md|SOL_USD = 180": { max: 1, why: "the finding that retired it" },
  "docs/REFRESH.md|SOL_USD = 180": { max: 1, why: "the dated note recording that this doc used to say it" },
  "docs/UPSTREAM-STATS-API.md|1% of trading volume": { max: 1, why: "verbatim upstream API response - their text, recorded as theirs" },
};

describe("retired figures cannot return to the docs", () => {
  const docs = [
    ...readdirSync(`${root}docs`).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`),
    "README.md",
  ];

  it("finds docs at all, so this cannot pass by finding nothing", () => {
    expect(docs.length).toBeGreaterThan(10);
  });

  it("carries no superseded value beyond its counted exemption", () => {
    const over: string[] = [];
    for (const f of docs) {
      let text: string;
      try { text = readFileSync(`${root}${f}`, "utf8"); } catch { continue; }
      for (const [bad, replacement] of SUPERSEDED) {
        const n = text.split(bad).length - 1;
        const allowed = DOC_EXEMPT[`${f}|${bad}`]?.max ?? 0;
        if (n > allowed) over.push(`${f}: "${bad}" x${n} (allowed ${allowed}) - use ${replacement}`);
      }
    }
    expect(over).toEqual([]);
  });

  it("every exemption is still needed, so the list cannot rot into a blanket pass", () => {
    const stale: string[] = [];
    for (const [key, { max }] of Object.entries(DOC_EXEMPT)) {
      const [f, bad] = key.split("|");
      const n = readFileSync(`${root}${f}`, "utf8").split(bad).length - 1;
      if (n < max) stale.push(`${key}: allows ${max}, found ${n} - lower it`);
    }
    expect(stale).toEqual([]);
  });
});
