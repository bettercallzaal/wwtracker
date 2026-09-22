#!/usr/bin/env tsx
/**
 * After a battle night: the 45-second window, per battle, as numbers.
 *
 *   npx tsx scripts/ww-45s-report.ts                          # every battle in the store touched in the last 6 h
 *   npx tsx scripts/ww-45s-report.ts 1789948124 1789949789    # named battles
 *   ... --marks ~/zao-vault/projects/ww-45s-marks-2026-09-21.log   # default: today's file
 *   ... --store var/ww-live
 *
 * Reads the marker log (scripts/ww-mark.sh), the watcher's samples, and each
 * battle account's start_time and end_time from chain, and prints, per battle:
 * the lag from chain open to the announce mark, how many trades landed before
 * the room heard it, and where each "sent" mark fell. Unknowns print as
 * UNKNOWN, never as 0.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { battlePda } from "../lib/ww/pda";
import { parseJsonl } from "../lib/ww/poolHistory";
import { DEFAULT_DIR, historyPath } from "../lib/poolHistoryStore";
import { battleWindow, describeWindow, parseMarks } from "../lib/ww/windowReport";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const args = process.argv.slice(2);
const opt = (n: string, d: string) => { const i = args.indexOf(n); return i > 0 ? args[i + 1] : d; };
const today = new Date().toISOString().slice(0, 10);
const MARKS = opt("--marks", join(process.env.HOME ?? "", "zao-vault/projects", `ww-45s-marks-${today}.log`));
const STORE = opt("--store", DEFAULT_DIR);
const ids = args.filter((a) => /^\d{9,12}$/.test(a)).map(Number);

async function account(id: number): Promise<{ startTime: number; endTime: number } | null> {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [battlePda(id), { encoding: "base64" }] }) });
  const j = await res.json();
  if (!j.result?.value) return null;
  const raw = Buffer.from(j.result.value.data[0], "base64");
  return { startTime: Number(raw.readBigInt64LE(20)), endTime: Number(raw.readBigInt64LE(28)) };
}

async function main() {
  const marks = existsSync(MARKS) ? parseMarks(readFileSync(MARKS, "utf8")) : [];
  console.log(`marks: ${marks.length} from ${MARKS}${existsSync(MARKS) ? "" : " (FILE MISSING: every lag below is UNKNOWN)"}`);
  let battles = ids;
  if (battles.length === 0) {
    const cutoff = Date.now() - 6 * 3600 * 1000;
    battles = readdirSync(STORE)
      .filter((f) => /^\d{9,12}\.jsonl$/.test(f) && statSync(join(STORE, f)).mtimeMs >= cutoff)
      .map((f) => Number(f.replace(".jsonl", "")));
    console.log(`battles: ${battles.length} in ${STORE} touched in the last 6 h`);
  }
  if (battles.length === 0) { console.log("nothing to report"); return; }
  console.log(`accounts via ${redactUrl(RPC)}\n`);
  for (const id of battles.sort()) {
    const acct = await account(id);
    if (!acct) { console.log(`battle ${id}: no account on chain, skipped`); continue; }
    const file = historyPath(STORE, id);
    const samples = existsSync(file) ? parseJsonl(readFileSync(file, "utf8")).samples : [];
    for (const line of describeWindow(battleWindow(id, acct, marks, samples))) console.log(line);
    console.log("");
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
