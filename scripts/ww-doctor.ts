/**
 * One command that says whether everything we rely on is working right now.
 *
 *   npx tsx scripts/ww-doctor.ts
 *
 * WHY PER-METHOD AND NOT PER-ENDPOINT. The public RPC rate limits each method
 * separately - on 2026-09-20 `getTransaction` returned "Too many requests for a
 * specific RPC call" for an hour while `getAccountInfo` and
 * `getProgramAccounts` kept answering normally. A single ping would have called
 * that endpoint healthy and it would have been, for everything except the one
 * tool that needed it. So each method this estate uses gets its own check.
 *
 * THERE IS NO FREE FALLBACK, and that is measured rather than assumed. Six
 * public endpoints were probed on 2026-09-20: publicnode did not resolve, drpc
 * returned 400, ankr and rpcpool 403, onfinality 429, omniatech 521. Only
 * api.mainnet-beta.solana.com answered. Redundancy here needs a keyed endpoint;
 * it cannot be assembled out of free ones, and pretending otherwise would put a
 * failover in the code that has nowhere to fail over to.
 */
import { PROGRAM_ID, battlePda } from "@/lib/ww/pda";
import { quoteBuy, supplyAtPool, SUPPLY_QUANTUM } from "@/lib/ww/quote";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

const PRIMARY = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const KEYED = Boolean(process.env.SOLANA_RPC_URL);
const WATCH_LOG = `${homedir()}/.zao/wwtracker/finals-watch.log`;
const KNOWN_BATTLE = 1789790992;

let pass = 0, fail = 0, warn = 0;
const ok = (m: string) => { pass++; console.log(`  PASS  ${m}`); };
const bad = (m: string) => { fail++; console.log(`  FAIL  ${m}`); };
const meh = (m: string) => { warn++; console.log(`  WARN  ${m}`); };

async function call(method: string, params: unknown[], ms = 15000) {
  const t0 = Date.now();
  try {
    const r = await fetch(PRIMARY, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(ms) });
    const j: any = await r.json().catch(() => ({}));
    return { ok: r.status === 200 && !j.error, status: r.status, err: j.error?.message ?? null, ms: Date.now() - t0, result: j.result };
  } catch (e: any) { return { ok: false, status: 0, err: e.message?.slice(0, 60), ms: Date.now() - t0, result: null }; }
}

async function main() {
  console.log(`\nendpoint: ${KEYED ? "SOLANA_RPC_URL (keyed)" : "public mainnet-beta - no fallback exists, see the header"}\n`);

  console.log("RPC, per method (they rate limit separately):");
  const pda = battlePda(KNOWN_BATTLE);
  const acct = await call("getAccountInfo", [pda, { encoding: "base64" }]);
  acct.ok ? ok(`getAccountInfo ${acct.ms}ms`) : bad(`getAccountInfo - ${acct.status} ${acct.err ?? ""}`);

  const sigs = await call("getSignaturesForAddress", [pda, { limit: 3 }]);
  sigs.ok ? ok(`getSignaturesForAddress ${sigs.ms}ms`) : bad(`getSignaturesForAddress - ${sigs.status} ${sigs.err ?? ""}`);

  if (sigs.ok && sigs.result?.[0]?.signature) {
    const tx = await call("getTransaction", [sigs.result[0].signature, { maxSupportedTransactionVersion: 0, encoding: "json" }]);
    if (tx.ok) ok(`getTransaction ${tx.ms}ms  (ww-verify-battle.ts usable)`);
    else meh(`getTransaction - ${tx.status} ${tx.err ?? ""}  (ww-verify-battle.ts BLOCKED; the watcher does not need it)`);
  } else meh("getTransaction - not tested, no signature to try");

  const gpa = await call("getProgramAccounts", [PROGRAM_ID,
    { encoding: "base64", filters: [{ dataSize: 353 }], dataSlice: { offset: 0, length: 256 } }], 30000);
  if (!gpa.ok) bad(`getProgramAccounts - ${gpa.status} ${gpa.err ?? ""}  (discovery and the watcher are blind)`);
  else {
    const rows: any[] = gpa.result ?? [];
    ok(`getProgramAccounts ${gpa.ms}ms, ${rows.length} battle accounts`);

    const now = Math.floor(Date.now() / 1000);
    let live = 0, awaiting = 0;
    for (const a of rows) {
      const raw = Buffer.from(a.account.data[0], "base64");
      const id = Number(raw.readBigUInt64LE(8));
      if (id < 1_600_000_000 || id > 2_600_000_000) continue;
      const end = Number(raw.readBigInt64LE(28));
      if (end > now && raw[245] === 0) live++;
      else if (raw[245] === 0) awaiting++;
    }
    console.log(`\nchain state:`);
    live ? ok(`${live} battle(s) LIVE right now`) : console.log(`  ----  no live battle (expected before a show starts)`);
    console.log(`  ----  ${awaiting} past their end time and unsettled`);
  }

  console.log(`\nour model against a known battle:`);
  if (!acct.ok) bad("cannot check - getAccountInfo failed");
  else {
    const raw = Buffer.from(acct.result.value.data[0], "base64");
    const pool = Number(raw.readBigUInt64LE(212));
    const supply = Number(raw.readBigUInt64LE(196));
    const curve = supplyAtPool(pool);
    const drift = curve - supply;
    if (drift >= 0 && drift < SUPPLY_QUANTUM * 4)
      ok(`supply sits ${drift.toFixed(0)} below the curve - the expected flooring residual`);
    else bad(`supply ${supply} vs curve ${curve.toFixed(0)} - drift ${drift.toFixed(0)} is outside the expected range`);
    const q = quoteBuy(pool, 10_000_000);
    q.tokensOut > 0 && q.tokensOut % SUPPLY_QUANTUM === 0
      ? ok(`quoteBuy returns a whole step (${q.tokensOut.toLocaleString()} tokens for 0.01 SOL)`)
      : bad(`quoteBuy returned ${q.tokensOut}, not a whole step`);
  }

  console.log(`\nthe watcher:`);
  try {
    const age = Math.floor((Date.now() - statSync(WATCH_LOG).mtimeMs) / 1000);
    const text = readFileSync(WATCH_LOG, "utf8");
    const beats = text.split("\n").filter((l) => l.includes("alive -"));
    const mismatches = text.split("\n").filter((l) => l.includes("MISMATCH"));
    if (!beats.length) meh(`log exists but has never beaten - started under a minute ago, or stuck`);
    else if (age > 180) bad(`last wrote ${age}s ago - it should beat every 60s. Probably dead.`);
    else ok(`beating, last write ${age}s ago`);
    if (beats.length) console.log(`  ----  ${beats[beats.length - 1].trim()}`);
    mismatches.length ? bad(`${mismatches.length} MISMATCH line(s) in the log - our model disagreed with the program`)
                      : console.log(`  ----  no mismatches logged`);
  } catch { meh(`no log at ${WATCH_LOG} - the watcher is not running`); }

  console.log(`\n${pass} pass, ${fail} fail, ${warn} warn`);
  if (fail) console.log(`SOMETHING IS BROKEN - the FAIL lines say what.`);
  else if (warn) console.log(`Usable. The WARN lines are things that limit what can be run, not breakage.`);
  else console.log(`All good.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("doctor itself failed:", e.message); process.exit(2); });
