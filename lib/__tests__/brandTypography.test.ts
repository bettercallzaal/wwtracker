/**
 * Two brand rules that had no guard, on the surface where breaking them is
 * visible: no em dashes, no decorative symbols standing in for words.
 *
 * They are the oldest rules here - they sit at the top of the global CLAUDE.md,
 * above everything else - and on 2026-09-24 an audit found 57 em dashes across
 * 11 rendered files. Three were in `app/layout.tsx`, which is the site title,
 * the Open Graph card and the Twitter card: the highest-reach strings the
 * project has, the same three fields `supersededFigures.test.ts` was written
 * about after they carried a retired figure for two months.
 *
 * Nothing had gone wrong. Nothing could have gone right either. The rule lived
 * in a machine-local file that no check ever read, which is the shape the global
 * rules themselves warn about: a law is only as wide as the file that loads it.
 *
 * SCOPE is the rendered surface, `app/` and `components/`. Quoted source
 * material keeps its own punctuation and lives under `docs/` and `recaps/`,
 * which this does not touch - a transcript of somebody saying "Wave Wars" out
 * loud is evidence, not a spelling mistake.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Character, and what to write instead - the message a failure should print.
 *
 * A registry of CHARACTERS for the same reason `supersededFigures` is a
 * registry of VALUES: it does not care which file, so it cannot be defeated by
 * adding one. Currency and mathematical signs are deliberately absent. The
 * Solana glyph in `PlatformAnalytics.tsx` denotes a unit, and a minus sign
 * denotes subtraction; neither is standing in for a word.
 *
 * THE EN DASH IS DELIBERATELY NOT HERE, and it was, for one run of this file.
 * The rule bans the em dash. This surface uses the en dash five times and
 * every one is a range - Jul 17-23, ZAOOS docs 1200-1202, a 12W-5L record -
 * which is what the character is for. Banning it would have been a rule this
 * guard invented and then enforced across the UI on its own authority. The
 * spaced one on the tournament page is the single arguable case, an en dash
 * doing an em dash's job; that is left for Zaal rather than settled here.
 *
 * The codepoints are written escaped so this file does not contain the
 * characters it bans.
 */
const BANNED: Array<[string, string, string]> = [
  ["\u2014", "em dash", "a plain hyphen -"],
  ["\u2705", "white heavy check mark", "the word DONE or VERIFIED"],
  ["\u274C", "cross mark", "the word FAILED or NO"],
  ["\u26A0", "warning sign", "the word WARNING"],
  ["\u23FA", "record button", "a text label"],
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

const files = surfaceFiles("app").concat(surfaceFiles("components"));
const sources = files.map((f) => [f, readFileSync(`${root}${f}`, "utf8")] as const);

it("is reading a real surface, not an empty directory", () => {
  // The positive control. An empty file list and a clean file list produce the
  // same green, and this guard exists because of a rule that says so.
  expect(files.length).toBeGreaterThan(30);
  expect(sources.some(([, s]) => s.includes("WaveWarZ"))).toBe(true);
});

describe.each(BANNED)("%s (%s)", (ch, name, instead) => {
  it(`appears nowhere on the rendered surface - write ${instead}`, () => {
    const hits = sources
      .filter(([, s]) => s.includes(ch))
      .map(([f, s]) => `${f}: ${s.split("\n").filter((l) => l.includes(ch)).length} line(s)`);
    expect(hits, `${name} is banned; write ${instead}`).toEqual([]);
  });
});

it("CONTROL: the check really does fire on a banned character", () => {
  // Without this, a typo in BANNED - or a codepoint that never matches - reads
  // exactly like a surface that is clean.
  for (const [ch, name] of BANNED) {
    expect(`a ${ch} b`.includes(ch), name).toBe(true);
  }
});
