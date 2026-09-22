#!/usr/bin/env tsx
/**
 * Rebuild a battle's pool history from its own transactions and write it to
 * the store /api/ww/pool-history reads.
 *
 *   npx tsx scripts/ww-pool-backfill.ts <battleId>            # refuses if the file exists
 *   npx tsx scripts/ww-pool-backfill.ts <battleId> --force    # overwrite
 *   npx tsx scripts/ww-pool-backfill.ts <battleId> --dry-run  # print, write nothing
 *   ... --store <dir>                                          # default var/ww-live
 *
 * No curve. The vault's balance delta is the pool delta and the mint's token
 * delta is the supply delta, per transaction (lib/ww/poolBackfill.ts). At the
 * end the replay is compared to the account's pools and supplies, and the
 * script says EXACT or names every field that differs. A mismatch still
 * writes with --force, but it prints first, because a chart that is a few
 * lamports off is better than none and a chart that is silently off is worse.
 *
 * Public RPC by default (SOLANA_RPC_URL if set; never printed). Signatures
 * are paged 1,000 at a time; each transaction is one request. A battle with
 * 66 signatures takes about 15 s on the public endpoint with the pacing here.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { battlePda, mintPda, vaultPda } from "../lib/ww/pda";
import { endStateDiff, replayTrades, tradeFromTransaction, type TradeStep, type TxLike } from "../lib/ww/poolBackfill";
import { DEFAULT_DIR, historyPath } from "../lib/poolHistoryStore";
import { redactUrl } from "../lib/redact";
import { serializeSample } from "../lib/ww/poolHistory";
import { optionValue } from "../lib/cliArgs";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
// Via lib/cliArgs so a flag in FIRST position is not silently dropped: this
// line used to read `i > 0` against an already-sliced array, which returned
// the default for `--marks FILE` when --marks was the first argument.
const opt = (n: string, d: string) => optionValue(args, n, d);
const battleId = Number(args.find((a) => /^\d{9,12}$/.test(a)));
if (!battleId) { console.error("usage: ww-pool-backfill.ts <battleId> [--force] [--dry-run] [--store dir]"); process.exit(2); }
const STORE = opt("--store", DEFAULT_DIR);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  for (let i = 0; i < 8; i++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (res.status === 429) { await sleep(800 * (i + 1)); continue; }
    const j = await res.json();
    if (j.error) { if (i < 7) { await sleep(500 * (i + 1)); continue; } throw new Error(`${method}: ${JSON.stringify(j.error).slice(0, 200)}`); }
    return j.result as T;
  }
  throw new Error(`${method}: rate limited after 8 tries`);
}

async function main() {
  const pda = battlePda(battleId);
  const ids = { vault: vaultPda(battleId), mintA: mintPda(battleId, "a"), mintB: mintPda(battleId, "b") };
  const path = historyPath(STORE, battleId);
  if (existsSync(path) && !flag("--force") && !flag("--dry-run")) {
    console.error(`${path} exists; pass --force to overwrite or --dry-run to only print`);
    process.exit(3);
  }
  console.log(`battle ${battleId}  pda ${pda}  rpc ${redactUrl(RPC)}`);

  // 1. Every signature on the battle account, newest first, paged.
  const sigs: Array<{ signature: string; slot: number; err: unknown }> = [];
  let before: string | undefined;
  for (;;) {
    const page = await rpc<Array<{ signature: string; slot: number; err: unknown }>>("getSignaturesForAddress", [pda, { limit: 1000, before }]);
    sigs.push(...page);
    if (page.length < 1000) break;
    before = page[page.length - 1].signature;
  }
  console.log(`signatures: ${sigs.length} (${sigs.filter((s) => s.err).length} failed on chain, skipped without fetching)`);

  // 2. Each successful one, oldest first, one request each.
  const steps: TradeStep[] = [];
  let fetched = 0, trades = 0, other = 0;
  for (const s of [...sigs].reverse()) {
    if (s.err) continue;
    const tx = await rpc<TxLike | null>("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 0 }]);
    fetched++;
    await sleep(150);
    if (!tx) { console.log(`  ${s.signature.slice(0, 12)} not returned by the RPC; skipped`); continue; }
    const step = tradeFromTransaction(s.signature, tx, ids);
    if (step) { steps.push(step); trades++; } else other++;
    if (fetched % 20 === 0) console.log(`  fetched ${fetched}, trades ${trades}, other ${other}`);
  }
  console.log(`fetched ${fetched}: ${trades} trades, ${other} other instructions`);

  // 3. Replay, then check against the account.
  const samples = replayTrades(steps);
  const acct = await rpc<{ value: { data: [string, string] } | null }>("getAccountInfo", [pda, { encoding: "base64" }]);
  if (!acct.value) throw new Error(`no account at ${pda}`);
  const raw = Buffer.from(acct.value.data[0], "base64");
  const u = (o: number) => Number(raw.readBigUInt64LE(o));
  const account = { a: u(212), b: u(220), sa: u(196), sb: u(204) };
  const diff = endStateDiff(samples, account);
  const last = samples[samples.length - 1];
  console.log(`replay end: pools ${last?.a ?? 0}/${last?.b ?? 0}  supplies ${last?.sa ?? 0}/${last?.sb ?? 0}`);
  console.log(`account:    pools ${account.a}/${account.b}  supplies ${account.sa}/${account.sb}`);
  if (diff.length === 0) console.log("end state: EXACT");
  else for (const d of diff) console.log(`end state: MISMATCH ${d.field} replay ${d.replay} account ${d.account} (off by ${d.replay - d.account})`);

  if (flag("--dry-run")) { console.log(`dry run: ${samples.length} samples not written`); return; }
  if (samples.length === 0) { console.log("no trades; nothing written"); return; }
  // Overwrite as one write rather than appending sample by sample: a partial
  // file from a killed run would be indistinguishable from a quiet battle.
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, samples.map(serializeSample).join("\n") + "\n");
  console.log(`wrote ${samples.length} samples to ${path} (${diff.length === 0 ? "verified against the account" : "NOT verified, see mismatch above"})`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });

