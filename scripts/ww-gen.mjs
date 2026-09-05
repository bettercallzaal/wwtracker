#!/usr/bin/env node
// Regenerate lib/wwData.ts.
//
// Replaces the old scripts/ww-gen.py, which read a set of /tmp/ww-*.json files
// produced by scripts/ww-research.sh. Two things were wrong with that pipeline
// and are fixed here:
//
// 1. Every query it ran filtered `block_date >= date '2025-08-01'`. The
//    program's first instruction is 2025-05-26, so three months of the
//    platform's history were silently missing from every "all-time" figure.
//    The counts it produced were roughly 45 percent low.
// 2. It also pulled one wallet's per-trade PnL series. That was the cofounder's
//    own trading record, which is a different question from how the platform is
//    doing, and it is out of scope now - this repo tracks the business.
// 3. Daily activity and the instruction mix are no longer fetched here at all.
//    They live in public/ww-onchain-daily.json, which the app also serves
//    directly to the browser, so there is exactly one copy of that series
//    rather than a JSON file and a TypeScript literal that can drift apart.
//
// Inputs:
//   public/ww-onchain-daily.json     - daily activity + decoded instruction mix
//   public/ww-platform-volume.json   - daily both-sides SOL volume
//   <dune-dir>/traders.json          - top signers by tx count
//   <dune-dir>/devflow.json          - treasury daily inflow/outflow/net
//   <dune-dir>/signers.json          - COUNT(DISTINCT tx_signer), all time
//
// The three Dune files are raw `GET /v1/execution/{id}/results` responses.
// Usage: node scripts/ww-gen.mjs [dune-dir]   (default /tmp/ww-dune)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DUNE_DIR = process.argv[2] ?? "/tmp/ww-dune";

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

/** Rows out of a Dune results envelope, or [] if the file is absent. */
function duneRows(name) {
  const p = join(DUNE_DIR, `${name}.json`);
  if (!existsSync(p)) {
    console.warn(`[warn] ${p} missing - that section will be empty`);
    return [];
  }
  return readJson(p)?.result?.rows ?? [];
}

const round = (n, dp) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// --- daily activity + instruction mix ---------------------------------------
const onchain = readJson("public/ww-onchain-daily.json");
const active = onchain.filter((d) => d.txs > 0);

const daily = active.map((d) => ({
  block_date: d.date,
  txs: d.txs,
  traders: d.traders,
}));

// `trades` is buys plus sells - the timeline is about trading pressure against
// battle cadence, so the two sides belong in one number here.
const timeline = active.map((d) => ({
  block_date: d.date,
  battles: d.created,
  trades: d.buys + d.sells,
  claims: d.claims,
}));

const sum = (f) => onchain.reduce((a, d) => a + f(d), 0);
const program = {
  battlesCreated: sum((d) => d.created),
  battlesSettled: sum((d) => d.settled),
  buys: sum((d) => d.buys),
  sells: sum((d) => d.sells),
  claims: sum((d) => d.claims),
  // Distinct signers cannot be summed across days without double counting, so
  // this comes from the signer list, not from the daily series.
  uniqueTraders: 0,
};

// --- volume -----------------------------------------------------------------
const volDays = readJson("public/ww-platform-volume.json");
const buysByDate = new Map(onchain.map((d) => [d.date, d.buys]));
const series = volDays
  .filter((d) => d.vol > 0)
  .map((d) => ({
    block_date: d.date,
    vol: round(d.vol, 4),
    buys: buysByDate.get(d.date) ?? 0,
  }));
const volume = {
  total: round(volDays.reduce((a, d) => a + d.vol, 0), 4),
  series,
  // Per-signer volume needs an account_activity join that the free Dune tier
  // times out on. Left empty rather than shipping a stale board; nothing in the
  // app reads it today.
  board: [],
};

// --- treasury flow ----------------------------------------------------------
const devflow = duneRows("devflow").map((r) => ({
  block_date: String(r.block_date).slice(0, 10),
  inflow: round(Number(r.inflow), 4),
  outflow: round(Number(r.outflow), 4),
  net: round(Number(r.net), 4),
}));

// --- top signers ------------------------------------------------------------
const traders = duneRows("traders").map((r) => ({
  trader: r.trader,
  txs: Number(r.txs),
}));
// Distinct signers comes from its own COUNT(DISTINCT) query, never from the
// length of the top-signers list. That list is LIMITed, so using its length
// reported 60 unique traders against a real 165 - a wrong number that looked
// perfectly plausible sitting next to correct ones.
const signerRows = duneRows("signers");
program.uniqueTraders = Number(signerRows[0]?.unique_traders ?? 0);
if (!program.uniqueTraders) {
  throw new Error("signers.json missing or empty - refusing to emit a snapshot with uniqueTraders 0");
}

// --- platform totals --------------------------------------------------------
const platformStats = {
  programTxs: sum((d) => d.txs),
  activeDays: active.length,
  firstDay: active[0]?.date ?? "",
  lastDay: active[active.length - 1]?.date ?? "",
  treasuryInflow: round(devflow.reduce((a, d) => a + d.inflow, 0), 4),
  treasuryOutflow: round(devflow.reduce((a, d) => a + d.outflow, 0), 4),
  treasuryNet: round(devflow.reduce((a, d) => a + d.net, 0), 4),
};

// --- emit -------------------------------------------------------------------
const header = readFileSync("lib/wwData.ts", "utf8").split("export const WW: WwSnapshot = {")[0];
const j = (v) => JSON.stringify(v);

const out = `${header}export const WW: WwSnapshot = {
  generatedAt: ${j(new Date().toISOString().slice(0, 16) + "Z")},
  daily: ${j(daily)},
  traders: ${j(traders)},
  devflow: ${j(devflow)},
  platformStats: ${j(platformStats)},
  program: ${j(program)},
  timeline: ${j(timeline)},
  volume: ${j(volume)},
};
`;
writeFileSync("lib/wwData.ts", out);

console.log("lib/wwData.ts regenerated");
console.table({
  programTxs: platformStats.programTxs,
  activeDays: platformStats.activeDays,
  range: `${platformStats.firstDay} -> ${platformStats.lastDay}`,
  battlesCreated: program.battlesCreated,
  battlesSettled: program.battlesSettled,
  buys: program.buys,
  sells: program.sells,
  claims: program.claims,
  uniqueTraders: program.uniqueTraders,
  volumeTotal: volume.total,
  treasuryNet: platformStats.treasuryNet,
});
