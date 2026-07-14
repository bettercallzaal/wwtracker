#!/usr/bin/env node
// Lightweight data validation. Catches broken/empty snapshots before they ship.
// Run: node scripts/validate.mjs   (exits 1 on any failure)
import { readFileSync } from "node:fs";

let failures = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => { console.log(`  FAIL ${m}`); failures++; };

function json(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { bad(`${path} unreadable: ${e.message}`); return null; }
}

// public/ww-battles.json
const battles = json("public/ww-battles.json");
if (Array.isArray(battles)) {
  // Floor guards against an empty/truncated snapshot; ceiling is a loose sanity
  // check against a runaway duplication bug, not a cap on legitimate growth -
  // the live fetch (npm run fetch:battles) adds real new battles over time.
  battles.length >= 800 && battles.length <= 5000 ? ok(`battles count ${battles.length}`) : bad(`battles count ${battles.length} (expected 800-5000)`);
  const req = ["id", "type", "a", "b", "winner"];
  const baddrow = battles.find((b) => req.some((k) => !b || b[k] == null || b[k] === ""));
  baddrow ? bad(`battle missing fields: ${JSON.stringify(baddrow)}`) : ok("every battle has id/type/a/b/winner");
  const types = new Set(battles.map((b) => b.type));
  // UNCLASSIFIED is a legitimate type from the recap pipeline's fetch step: the
  // live feed has no type field, so a new null-margin battle (could be MAIN or
  // COMMUNITY - not distinguishable from the feed alone) is tagged UNCLASSIFIED
  // until manually reviewed. See docs/superpowers/specs/2026-07-14-recap-pipeline-design.md.
  [...types].every((t) => ["QUICK", "MAIN", "COMMUNITY", "UNCLASSIFIED"].includes(t)) ? ok(`battle types ${[...types].join(",")}`) : bad(`unexpected battle type in ${[...types]}`);
} else bad("battles not an array");

// public/ww-skips.json + ww-queue.json
for (const [name, lo] of [["ww-skips", 30], ["ww-queue", 30]]) {
  const d = json(`public/${name}.json`);
  if (d && typeof d === "object") {
    const n = Object.keys(d).length;
    n >= lo ? ok(`${name} nights ${n}`) : bad(`${name} nights ${n} (expected >= ${lo})`);
  } else bad(`${name} not an object`);
}

// lib snapshots - count rows via a cheap regex so we notice if a regen empties them
for (const [file, marker, min] of [
  ["lib/leaderboard.ts", /rank:\d+|"rank":\d+/g, 40],
  ["lib/traders.ts", /"rank":\d+|rank:\d+/g, 90],
  ["lib/songs.ts", /rank: \d+/g, 37],
]) {
  try {
    const m = (readFileSync(file, "utf8").match(marker) || []).length;
    m >= min ? ok(`${file} ~${m} rows`) : bad(`${file} ~${m} rows (expected >= ${min})`);
  } catch (e) { bad(`${file}: ${e.message}`); }
}

console.log(failures ? `\nVALIDATION FAILED (${failures})` : "\nvalidation passed");
process.exit(failures ? 1 : 0);
