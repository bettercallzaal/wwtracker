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
  battles.length >= 800 && battles.length <= 1000 ? ok(`battles count ${battles.length}`) : bad(`battles count ${battles.length} (expected 800-1000)`);
  const req = ["id", "type", "a", "b", "winner"];
  const baddrow = battles.find((b) => req.some((k) => !b || b[k] == null || b[k] === ""));
  baddrow ? bad(`battle missing fields: ${JSON.stringify(baddrow)}`) : ok("every battle has id/type/a/b/winner");
  const types = new Set(battles.map((b) => b.type));
  [...types].every((t) => ["QUICK", "MAIN", "COMMUNITY"].includes(t)) ? ok(`battle types ${[...types].join(",")}`) : bad(`unexpected battle type in ${[...types]}`);
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
