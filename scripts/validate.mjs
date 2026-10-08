#!/usr/bin/env node
// Lightweight data validation. Catches broken/empty snapshots before they ship.
// Run: node scripts/validate.mjs   (exits 1 on any failure)
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { classifyRechecks, overdueReport, RECHECK_WARN_DAYS, STALE_DAYS, WARN_DAYS } from "./recheck.mjs";

let failures = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const bad = (m) => { console.log(`  FAIL ${m}`); failures++; };

function json(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { bad(`${path} unreadable: ${e.message}`); return null; }
}

// vercel.json
// Vercel caps ignoreCommand at 256 characters and rejects the ENTIRE
// vercel.json above that - schema validation fails before any build starts, so
// the deployment errors instantly with no build log to read. A 302-character
// command shipped once and cost a production deploy plus a long detour into
// hypotheses about the application code, which was never involved.
const vercelCfg = json("vercel.json");
if (vercelCfg && typeof vercelCfg === "object") {
  const cmd = typeof vercelCfg.ignoreCommand === "string" ? vercelCfg.ignoreCommand : "";
  if (!cmd) {
    ok("vercel.json has no ignoreCommand");
  } else {
    cmd.length <= 256
      ? ok(`vercel.json ignoreCommand ${cmd.length}/256 chars`)
      : bad(`vercel.json ignoreCommand is ${cmd.length} chars - Vercel rejects over 256`);
  }
} else bad("vercel.json unreadable");

// public/ww-battles.json
const battles = json("public/ww-battles.json");
if (Array.isArray(battles)) {
  // Floor guards against an empty/truncated snapshot; ceiling is a loose sanity
  // check against a runaway duplication bug, not a cap on legitimate growth -
  // the live fetch (npm run fetch:battles) adds real new battles over time.
  battles.length >= 800 && battles.length <= 5000 ? ok(`battles count ${battles.length}`) : bad(`battles count ${battles.length} (expected 800-5000)`);
  // `winner` is deliberately NOT required. The file is built from the public
  // API, which returns no winnerSide for a battle that has not been decided -
  // 8 of 1,510 on 2026-09-09. The scrape this replaced dropped such rows
  // entirely, which is how the file came to be missing 213 battles spread
  // across every month. A battle nobody has judged yet is still a battle.
  const req = ["id", "type", "a", "b"];
  const baddrow = battles.find((b) => req.some((k) => !b || b[k] == null || b[k] === ""));
  baddrow ? bad(`battle missing fields: ${JSON.stringify(baddrow)}`) : ok("every battle has id/type/a/b");
  const undecided = battles.filter((b) => b.winner == null).length;
  undecided <= battles.length * 0.05
    ? ok(`battles awaiting a winner ${undecided}/${battles.length}`)
    : bad(`battles awaiting a winner ${undecided}/${battles.length} - over 5%, the winner source may have broken`);
  const types = new Set(battles.map((b) => b.type));
  // UNCLASSIFIED is still accepted, but nothing produces it any more. It existed
  // because the scraped feed had no type field, so a null-margin battle could be
  // MAIN or COMMUNITY and was parked until a human looked. The public API states
  // the type outright, so the guess - and the backlog it created - is gone.
  [...types].every((t) => ["QUICK", "MAIN", "COMMUNITY", "UNCLASSIFIED"].includes(t)) ? ok(`battle types ${[...types].join(",")}`) : bad(`unexpected battle type in ${[...types]}`);
} else bad("battles not an array");

// public/ww-skips.json + ww-queue.json + ww-wavysplit.json
// No section renders these today, but they are actively maintained by hand
// (PR #212 extended the DJ Wavy split to 103 nights) and the skip-queue auction
// is real platform revenue. They are checked, not deleted - a maintained file
// with no reader is a widget waiting to be built, not dead weight.
for (const [name, lo] of [["ww-skips", 30], ["ww-queue", 30], ["ww-wavysplit", 30]]) {
  const d = json(`public/${name}.json`);
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const n = Object.keys(d).length;
    n >= lo ? ok(`${name} nights ${n}`) : bad(`${name} nights ${n} (expected >= ${lo})`);
  } else bad(`${name} not an object`);
}

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
// Buys, sells and claims render from this, not from Dune (lib/onchainCorrect.mjs).
const chainDaily = json("public/ww-chain-daily.json");
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
// A dataset past STALE_DAYS is printed as STALE, annotated in the GitHub UI,
// and listed in the "Overdue RE-CHECK claims" issue checks.yml keeps. It does
// NOT fail the build, under --strict or otherwise.
//
// Changed 2026-10-08. It used to fail under --strict, which CI runs, so main
// went red the day a dataset crossed 45 days with no code change, and every
// open PR with it - the same timer-red as the re-check dates (see
// scripts/recheck.mjs). Zaal ruled to fix the cause; the seat applied that
// ruling to staleness the same day.
//
// What still FAILS under --strict is a date that is WRONG rather than old: a
// dataset with no date the validator can read, or one dated after today. Those
// are broken figures, and no amount of waiting makes them right.
// Thresholds live in scripts/recheck.mjs.
// ---------------------------------------------------------------------------
const strict = process.argv.includes("--strict");

// Datasets knowingly parked past STALE_DAYS, each with the date its parking
// expires. These three describe the skip-queue auction and the DJ Wavy split -
// real, actively maintained data with no section rendering it yet (docs/AUDIT.md
// 3.4, and 4.2 for the widget that will). They are a backlog item, not neglect.
//
// The expiry is the point. An exemption with no deadline is the check switched
// off with extra steps. While parked, these are a quiet WARN. Past the date they
// are STALE like any other dataset - in the issue, with "parking expired" beside
// them - so the decision to keep parking them has to be made again out loud
// rather than inherited by silence. (Until 2026-10-08 an expired parking failed
// the build instead; see the staleness note above for why that changed.)
const KNOWN_STALE = {
  "public/ww-skips.json": "2026-10-15",
  "public/ww-queue.json": "2026-10-15",
  "public/ww-wavysplit.json": "2026-10-15",
};
let warnings = 0;
const warn = (m) => { console.log(`  WARN ${m}`); warnings++; };

// VALIDATE_TODAY=YYYY-MM-DD runs every date check as of that day. It exists so
// scripts/__tests__/recheck.test.ts can prove the gate both ways (an overdue
// claim warns, a stale dataset still fails) without waiting for the calendar.
// Anything other than a plain date is refused rather than silently ignored.
const TODAY = (() => {
  const v = process.env.VALIDATE_TODAY;
  if (v === undefined || v === "") return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) {
    console.log(`  FAIL VALIDATE_TODAY=${v} is not a YYYY-MM-DD date`);
    process.exit(1);
  }
  console.log(`  NOTE dates checked as of VALIDATE_TODAY=${v}, not the real clock`);
  return new Date(`${v}T12:00:00Z`);
})();
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
  ["public/ww-chain-daily.json", chainDaily?.measuredThrough ?? null],
];

for (const name of ["ww-skips", "ww-queue", "ww-wavysplit"]) {
  const d = json(`public/${name}.json`);
  datasets.push([`public/${name}.json`, d && typeof d === "object" ? newest(Object.keys(d)) : null]);
}

console.log("");
const staleItems = [];
const ghaOn = process.env.GITHUB_ACTIONS === "true";
for (const [label, raw] of datasets) {
  // A WRONG date, not an old one: these still fail under --strict.
  if (raw == null) { const m = `${label}: no date found - cannot check staleness`; strict ? bad(m) : warn(m); continue; }
  const d = raw instanceof Date ? raw : new Date(Date.parse(raw));
  if (Number.isNaN(d.getTime())) { const m = `${label}: unparseable date ${raw}`; strict ? bad(m) : warn(m); continue; }
  const age = daysOld(d);
  const stamp = d.toISOString().slice(0, 10);
  if (age < -1) {
    // More than a day ahead of the clock (a day of slack for time zones). Data
    // cannot be newer than now, so the date or the clock is wrong.
    const m = `${label}: newest record ${stamp} is ${-age} days in the future - the date is wrong`;
    strict ? bad(m) : warn(m);
    continue;
  }
  if (age >= STALE_DAYS) {
    const msg = `${label}: ${age} days old (newest ${stamp}, stale past ${STALE_DAYS})`;
    const parkedUntil = KNOWN_STALE[label];
    if (parkedUntil && TODAY < new Date(`${parkedUntil}T23:59:59Z`)) {
      warn(`${msg} - knowingly parked until ${parkedUntil}`);
    } else {
      // Loud, not a failure. See the staleness note above.
      const note = parkedUntil ? `parking expired ${parkedUntil}` : "";
      staleItems.push({ label, age, newest: stamp, note });
      console.log(`  STALE ${msg}${note ? ` - ${note}, refresh it or move the date deliberately` : ""}`);
      if (ghaOn) console.log(`::warning title=Stale data::${msg}${note ? ` (${note})` : ""}. See docs/REFRESH.md.`);
    }
  } else if (age >= WARN_DAYS) {
    warn(`${label}: ${age} days old (newest ${stamp})`);
  } else {
    ok(`${label}: ${age} days old (newest ${stamp})`);
  }
}

// ---------------------------------------------------------------------------
// Re-check dates on time-bound claims
// ---------------------------------------------------------------------------
//
// A claim about a program, a deadline, an external service or a setting another
// lane controls goes stale silently. On 2026-09-08 the estate counted five in one
// day - a protocol recorded as live that was not, an application drafted against
// a closed cycle, a VPS marked down that had been up for sixteen days, doc
// summaries contradicting their own bodies, and superseded pages with nothing
// marking them.
//
// The convention that came out of it was "write a re-check date next to the
// claim". That is an honor-system rule, and the estate's own measurement is that
// honor-system rules run at 3-40% while structurally enforced ones run at ~100%.
// So the convention is enforced here rather than trusted.
//
// Write `RE-CHECK BY YYYY-MM-DD` anywhere in a tracked file. The rules live in
// scripts/recheck.mjs. Past the date a claim is OVERDUE: loud everywhere a human
// looks (this output, a GitHub annotation, the job summary, and the one open
// issue checks.yml keeps), but NOT a build failure - see recheck.mjs for why
// that changed on 2026-10-08. A marker whose date is not a real date FAILS.
//
// --recheck-report <path> writes the issue body (empty when nothing is overdue).

const reportFlag = process.argv.indexOf("--recheck-report");
const reportPath = reportFlag > -1 ? process.argv[reportFlag + 1] : null;
if (reportFlag > -1 && !reportPath) bad("--recheck-report needs a path");
let overdueCount = 0;

function scanRecheckDates() {
  let files;
  try {
    files = execSync("git ls-files", { encoding: "utf8" }).trim().split("\n");
  } catch {
    // Strict callers are CI and the refresh job; both run in a checkout. A scan
    // that could not run there is a gate that did not run, so it fails.
    const m = "re-check scan could not run: not a git work tree";
    strict ? bad(m) : warn(m);
    return [];
  }
  const all = [];
  for (const f of files) {
    if (!/\.(md|ts|tsx|mjs|js|sh|json|yml)$/.test(f)) continue;
    // The files that define and test the marker would otherwise match themselves.
    if (f === "scripts/validate.mjs" || f === "scripts/recheck.mjs" || f === "scripts/__tests__/recheck.test.ts") continue;
    let text;
    try {
      text = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    all.push(...classifyRechecks(text, f, TODAY));
  }
  const gha = process.env.GITHUB_ACTIONS === "true";
  for (const e of all) {
    const where = `${e.file}:${e.line}: claim due for re-check ${e.due}`;
    if (e.status === "invalid") {
      bad(`${where} - not a real date, so it can never go overdue. Fix the date`);
    } else if (e.status === "overdue") {
      overdueCount++;
      console.log(`  OVERDUE ${where} - ${-e.daysLeft} day(s) past, re-verify it or move the date`);
      if (gha) console.log(`::warning file=${e.file},line=${e.line},title=RE-CHECK overdue::claim due ${e.due}, ${-e.daysLeft} day(s) past. Re-verify it or move the date (docs/RECHECK.md).`);
    } else if (e.status === "soon") {
      warn(`${where} - ${e.daysLeft} day(s) left (warns inside ${RECHECK_WARN_DAYS})`);
    } else {
      ok(`${where} - ${e.daysLeft} day(s) left`);
    }
  }
  if (all.length === 0) {
    // Not a pass. A repo with no dated claims is far likelier to have lost the
    // convention than to have no time-bound claims in it.
    warn("no RE-CHECK BY markers found anywhere - the convention has probably been dropped");
  }
  return all;
}

const rechecks = scanRecheckDates();
const report = overdueReport(rechecks, staleItems);
if (reportPath) writeFileSync(reportPath, report);
if (report && process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Overdue re-checks and stale data\n\n${report}\n`);
}

if (overdueCount || staleItems.length) {
  console.log(`\n${overdueCount} OVERDUE re-check claim(s) and ${staleItems.length} STALE dataset(s) above. Not a build failure; tracked in the "Overdue RE-CHECK claims" issue.`);
}
if (warnings && !failures) {
  console.log(`\n${warnings} staleness warning(s) - see docs/REFRESH.md. Re-run with --strict to fail on these.`);
}
console.log(failures ? `\nVALIDATION FAILED (${failures})` : "\nvalidation passed");
process.exit(failures ? 1 : 0);
