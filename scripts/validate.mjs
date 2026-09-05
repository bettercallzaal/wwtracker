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

// public/ww-platform-volume.json
const platVol = json("public/ww-platform-volume.json");
if (Array.isArray(platVol)) {
  platVol.length >= 100 ? ok(`ww-platform-volume rows ${platVol.length}`) : bad(`ww-platform-volume rows ${platVol.length} (expected >= 100)`);
  const badPv = platVol.find((r) => !r || !r.date || r.vol == null);
  badPv ? bad(`ww-platform-volume missing date/vol: ${JSON.stringify(badPv)}`) : ok("ww-platform-volume rows have date+vol");
} else bad("ww-platform-volume.json not an array");

// public/ww-onchain-daily.json - fresh decoded on-chain instruction data, gap-filled from
// program's first day (2025-05-26) to today. Replaces the stale lib/wwData.ts snapshot for
// on-chain activity charts and summaries.
const onchainDaily = json("public/ww-onchain-daily.json");
if (Array.isArray(onchainDaily)) {
  onchainDaily.length >= 300 ? ok(`ww-onchain-daily rows ${onchainDaily.length}`) : bad(`ww-onchain-daily rows ${onchainDaily.length} (expected >= 300)`);
  const badRow = onchainDaily.find((r) => !r || !r.date || r.txs == null);
  badRow ? bad(`ww-onchain-daily missing date/txs: ${JSON.stringify(badRow)}`) : ok("ww-onchain-daily rows have date+txs");
} else bad("ww-onchain-daily.json not an array");

// lib snapshots - count rows via a cheap regex so we notice if a regen empties them.
// Note: traders.ts and songs.ts now use live API data and no longer have baked arrays.
for (const [file, marker, min] of [
  ["lib/leaderboard.ts", /rank:\d+|"rank":\d+/g, 40],
]) {
  try {
    const m = (readFileSync(file, "utf8").match(marker) || []).length;
    m >= min ? ok(`${file} ~${m} rows`) : bad(`${file} ~${m} rows (expected >= ${min})`);
  } catch (e) { bad(`${file}: ${e.message}`); }
}

// Verify traders.ts and songs.ts have migrated to live data.
for (const file of ["lib/traders.ts", "lib/songs.ts"]) {
  try {
    const content = readFileSync(file, "utf8");
    content.includes("live") ? ok(`${file} migrated to live data`) : bad(`${file} missing live data comment`);
  } catch (e) { bad(`${file}: ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Staleness. Every check above counts rows - none of them look at DATES, so a
// snapshot frozen for months passed clean while the site served numbers that
// were 80+ days out. These report how old each dataset's newest record is.
//
// Warnings by default (a stale snapshot must not block an unrelated code
// deploy); pass --strict to turn them into failures for CI or a data-refresh PR.
// Thresholds: WARN_DAYS is "someone should refresh", STALE_DAYS is "this is
// misinforming people".
// ---------------------------------------------------------------------------
const strict = process.argv.includes("--strict");
const WARN_DAYS = 14;
const STALE_DAYS = 45;
let warnings = 0;
const warn = (m) => { console.log(`  WARN ${m}`); warnings++; };

const TODAY = new Date();
const daysOld = (d) => Math.floor((TODAY - d) / 86400000);

/** Latest parseable date in a list, or null. Handles ISO and "Aug 25, 2026". */
function newest(values) {
  let best = null;
  for (const v of values) {
    const t = Date.parse(v);
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best);
}

/** Read a string constant out of a .ts file, e.g. DATA_AS_OF = "2026-06-16". */
function tsConst(file, name) {
  try {
    const m = readFileSync(file, "utf8").match(
      new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`),
    );
    return m ? m[1] : null;
  } catch { return null; }
}

const datasets = [
  ["lib/freshness.ts DATA_AS_OF", tsConst("lib/freshness.ts", "DATA_AS_OF")],
  ["lib/price.ts SOL_USD_AS_OF", tsConst("lib/price.ts", "SOL_USD_AS_OF")],
  ["public/ww-battles.json", Array.isArray(battles) ? newest(battles.map((b) => b.date)) : null],
  ["public/ww-platform-volume.json", Array.isArray(platVol) ? newest(platVol.map((r) => r.date)) : null],
  ["public/ww-onchain-daily.json", Array.isArray(onchainDaily) ? newest(onchainDaily.map((r) => r.date)) : null],
];

console.log("");
for (const [label, raw] of datasets) {
  if (raw == null) { warn(`${label}: no date found - cannot check staleness`); continue; }
  const d = raw instanceof Date ? raw : new Date(Date.parse(raw));
  if (Number.isNaN(d.getTime())) { warn(`${label}: unparseable date ${raw}`); continue; }
  const age = daysOld(d);
  const stamp = d.toISOString().slice(0, 10);
  if (age >= STALE_DAYS) {
    const msg = `${label}: ${age} days old (newest ${stamp}, stale past ${STALE_DAYS})`;
    strict ? bad(msg) : warn(msg);
  } else if (age >= WARN_DAYS) {
    warn(`${label}: ${age} days old (newest ${stamp})`);
  } else {
    ok(`${label}: ${age} days old (newest ${stamp})`);
  }
}

if (warnings && !failures) {
  console.log(`\n${warnings} staleness warning(s) - see docs/REFRESH.md. Re-run with --strict to fail on these.`);
}
console.log(failures ? `\nVALIDATION FAILED (${failures})` : "\nvalidation passed");
process.exit(failures ? 1 : 0);
