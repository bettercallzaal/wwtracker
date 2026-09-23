/**
 * Extend public/ww-daily-treasury.csv from chain, one UTC day per row.
 *
 *   npx tsx scripts/ww-treasury-backfill.ts --days 3            # prove the method cheaply
 *   npx tsx scripts/ww-treasury-backfill.ts --from 2026-07-22   # the real backfill
 *   npx tsx scripts/ww-treasury-backfill.ts --days 3 --write    # append to the CSV
 *
 * WHY IT EXISTS. That file ends at 2026-07-21. The homepage panel now says so
 * rather than labelling two-month-old figures "this week" (#355), but saying it
 * is stale is not the same as fixing it.
 *
 * WHY IT IS NOT RUN IN FULL HERE. Reaching 2026-07-22 takes about 3,100
 * `getTransaction` calls - measured 2026-09-23: the wallet averages 49
 * transactions a day. That is roughly twenty minutes of sustained load on the
 * public endpoint, which is the same endpoint the live watcher uses and which
 * had already started refusing about a quarter of its scans that morning. The
 * watcher matters more on a battle night than the CSV does. Run the full
 * backfill against a keyed endpoint, or in a quiet window, with `--from`.
 *
 * THE SELF-CHECK IS THE POINT. Balances are rebuilt by walking transactions and
 * accumulating each one's effect on the wallet. That chain of arithmetic is
 * only trustworthy if its end matches the wallet's balance as the chain reports
 * it right now, so the tool computes both and refuses to write when they differ.
 */
import { readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { optionValue } from "../lib/cliArgs";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const TREASURY = "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37";
const CSV = join(process.cwd(), "public", "ww-daily-treasury.csv");
const args = process.argv.slice(2);
const DAYS = Number(optionValue(args, "--days", "3"));
const FROM = optionValue(args, "--from", "");
const WRITE = args.includes("--write");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(method: string, params: unknown[]): Promise<any> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).catch(() => null);
    if (!res) { await sleep(800 * (i + 1)); continue; }
    if (res.status === 429) { await sleep(1200 * (i + 1)); continue; }
    const j = await res.json().catch(() => null);
    if (!j || j.error) { await sleep(700 * (i + 1)); continue; }
    return j.result;
  }
  throw new Error(`${method} gave up after 6 attempts`);
}

const utcDay = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);
const dayName = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

async function main() {
  const csvLastDate = readFileSync(CSV, "utf8").trim().split("\n").pop()!.split(",")[0];
  const cutoffDate = FROM || new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);
  const cutoff = Math.floor(Date.parse(`${cutoffDate}T00:00:00Z`) / 1000);
  console.log(`treasury backfill via ${redactUrl(RPC)}`);
  console.log(`CSV ends ${csvLastDate}; collecting from ${cutoffDate} (${WRITE ? "will append" : "dry run"})`);
  if (FROM && Date.parse(cutoffDate) > Date.parse(csvLastDate) + 86_400_000 * 1.5) {
    console.log(`NOTE: this leaves a gap between ${csvLastDate} and ${cutoffDate}. The rows below are not continuous with the file.`);
  }

  // 1. Signatures back to the cutoff.
  const sigs: Array<{ signature: string; blockTime: number }> = [];
  let before: string | undefined;
  for (;;) {
    const page = await rpc("getSignaturesForAddress", [TREASURY, before ? { limit: 1000, before } : { limit: 1000 }]);
    if (!page.length) break;
    for (const s of page) if (s.blockTime) sigs.push({ signature: s.signature, blockTime: s.blockTime });
    before = page[page.length - 1].signature;
    if (page[page.length - 1].blockTime && page[page.length - 1].blockTime < cutoff) break;
    await sleep(250);
  }
  const inRange = sigs.filter((s) => s.blockTime >= cutoff).sort((a, b) => a.blockTime - b.blockTime);
  console.log(`${sigs.length} signatures scanned, ${inRange.length} at or after ${cutoffDate}`);

  // 2. Each transaction's effect on the wallet, and the balance it left behind.
  const byDay = new Map<string, { delta: number; endBalance: number; endT: number; launches: number; failed: number }>();
  let missed = 0;
  for (const [i, s] of inRange.entries()) {
    const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null);
    if (!tx) { missed++; continue; }
    const keys: string[] = tx.transaction.message.accountKeys.map((k: any) => (typeof k === "string" ? k : k.pubkey));
    const idx = keys.indexOf(TREASURY);
    if (idx < 0) { missed++; continue; }
    const delta = tx.meta.postBalances[idx] - tx.meta.preBalances[idx];
    const day = utcDay(s.blockTime);
    const row = byDay.get(day) ?? { delta: 0, endBalance: 0, endT: 0, launches: 0, failed: 0 };
    row.delta += delta;
    if (s.blockTime >= row.endT) { row.endT = s.blockTime; row.endBalance = tx.meta.postBalances[idx]; }
    if ((tx.meta?.logMessages ?? []).some((l: string) => /Instruction: InitializeBattle/.test(l))) row.launches++;
    if (tx.meta?.err) row.failed++;
    byDay.set(day, row);
    if (i % 50 === 0) process.stdout.write(`\r  ${i + 1}/${inRange.length} transactions read`);
    await sleep(120);
  }
  console.log(`\r  ${inRange.length}/${inRange.length} transactions read${missed ? `, ${missed} UNREADABLE` : ""}`);

  // 3. The self-check: does the walk end where the chain says the wallet is?
  const onChain = (await rpc("getBalance", [TREASURY])).value as number;
  const days = [...byDay.keys()].sort();
  const walkEnd = days.length ? byDay.get(days[days.length - 1])!.endBalance : onChain;
  const agrees = walkEnd === onChain;
  console.log(`\nwalk ends at ${(walkEnd / 1e9).toFixed(6)} SOL; chain says ${(onChain / 1e9).toFixed(6)} SOL -> ${agrees ? "AGREE" : "DISAGREE"}`);
  if (missed) console.log(`${missed} transaction(s) could not be read, so the deltas below are incomplete by an unknown amount.`);

  console.log(`\ndate,day,balance_sol,delta_sol,battles_launched,battles_launched_onchain,notes,source`);
  for (const d of days) {
    const r = byDay.get(d)!;
    console.log(`${d},${dayName(d)},${(r.endBalance / 1e9).toFixed(6)},${(r.delta / 1e9).toFixed(6)},${r.launches || ""},${r.launches || ""},,on-chain (backfilled ${new Date().toISOString().slice(0, 10)})`);
  }

  if (!WRITE) { console.log(`\nDry run. Nothing written. Add --write to append.`); return; }
  if (!agrees || missed) {
    console.error(`\nREFUSING TO WRITE: the walk ${agrees ? "is missing transactions" : "does not end at the chain's balance"}. A CSV that looks authoritative and is wrong is worse than one that is out of date.`);
    process.exit(1);
  }
  const rows = days.filter((d) => d > csvLastDate)
    .map((d) => { const r = byDay.get(d)!; return `${d},${dayName(d)},${(r.endBalance / 1e9).toFixed(6)},${(r.delta / 1e9).toFixed(6)},${r.launches || ""},${r.launches || ""},,on-chain (backfilled ${new Date().toISOString().slice(0, 10)})`; });
  if (!rows.length) { console.log(`\nNothing to append: every day collected is already in the file.`); return; }
  appendFileSync(CSV, rows.join("\n") + "\n");
  console.log(`\nappended ${rows.length} row(s) to ${CSV}`);
}
main().catch((e) => { console.error(e.message); process.exit(2); });
