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
import { parseBattleAccounts, phaseCounts } from "@/lib/ww/discovery";
import { newestWatcherLog, watcherLogAgeSeconds, watcherVerdict } from "@/lib/watcherLog";
import { describePublicDataAges, publicDataAges } from "@/lib/publicDataAge";
import { quoteBuy, supplyAtPool, SUPPLY_QUANTUM } from "@/lib/ww/quote";
import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";

const PRIMARY = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const KEYED = Boolean(process.env.SOLANA_RPC_URL);
/**
 * WHERE THE WATCHER ACTUALLY WRITES, in the order to try.
 *
 * This checked `~/.zao/wwtracker/finals-watch.log` only. `scripts/ww-night.sh`
 * has redirected the watcher to `var/ww-live-watch.log` since it was written,
 * so on 2026-09-24 the doctor reported "last wrote 224510s ago - Probably
 * dead" and "1 MISMATCH line(s)" while the real watcher was beating every
 * three seconds two directories away. **A health check pointed at the wrong
 * file is worse than none: it cries wolf, and the numbers it does report are
 * from a run nobody is watching.**
 *
 * Both paths are tried, newest first, and the one used is PRINTED - naming the
 * surface you read is the difference between a finding and a guess.
 */
const WATCH_LOGS = ["var/ww-live-watch.log", `${homedir()}/.zao/wwtracker/finals-watch.log`];

/** The candidates that exist, in the order listed. The choice is in lib/watcherLog.ts. */
const existingWatchLogs = () =>
  WATCH_LOGS.flatMap((path) => {
    try {
      return [{ path, mtimeMs: statSync(path).mtimeMs }];
    } catch {
      return [];
    }
  });
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

    // THROUGH THE TESTED DECODER, not a second copy of it. This loop used to
    // re-derive the id, the end time and the settled byte from raw offsets,
    // which is the same decode `lib/ww/discovery.ts` does and tests. Two
    // copies of an offset table drift, and the one in a health check drifts
    // silently because nothing compares them.
    const battles = parseBattleAccounts(rows, (b) => new Uint8Array(Buffer.from(b, "base64")));
    const counts = phaseCounts(battles);
    console.log(`\nchain state:`);
    if (battles.length !== rows.length) {
      meh(`${rows.length - battles.length} of ${rows.length} accounts did not decode as battles`);
    }
    counts.live
      ? ok(`${counts.live} battle(s) LIVE right now`)
      : console.log(`  ----  no live battle (expected before a show starts)`);
    console.log(`  ----  ${counts["awaiting-settlement"]} past their end time and unsettled`);

    // THE FLAG THAT SHOULD NEVER FIRE, read by something. The account holds
    // artist_*_sol_balance at 212 and artist_*_pool at 228, and this repo read
    // 212 as the pool until 2026-09-24. They matched on all 1,709 accounts
    // then. If they ever stop matching, every quote built off the wrong one is
    // wrong - and a flag nothing reads would not say so.
    const disagreeing = battles.filter((b) => b.poolDisagreesWithBalance);
    if (disagreeing.length === 0) {
      ok(`sol_balance and pool agree on all ${battles.length} battles`);
    } else {
      bad(
        `sol_balance and pool DISAGREE on ${disagreeing.length} of ${battles.length} battles ` +
          `(first: ${disagreeing[0].battleId}) - every quote built off either is suspect`,
      );
    }
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
  const chosen = newestWatcherLog(existingWatchLogs());
  if (!chosen) {
    meh(`no watcher log at any of: ${WATCH_LOGS.join(", ")} - the watcher is not running`);
  } else {
    console.log(`  ----  reading ${chosen.path}`);
    try {
      const age = watcherLogAgeSeconds(chosen.mtimeMs);
      const text = readFileSync(chosen.path, "utf8");
      const beats = text.split("\n").filter((l) => l.includes("alive -"));
      const mismatches = text.split("\n").filter((l) => l.includes("MISMATCH"));
      const verdict = watcherVerdict(age, beats.length);
      if (verdict === "never-beat") meh(`log exists but has never beaten - started under a minute ago, or stuck`);
      else if (verdict === "stopped") bad(`last wrote ${age}s ago - it should beat every 60s. Probably dead.`);
      else ok(`beating, last write ${age}s ago`);
      if (beats.length) console.log(`  ----  ${beats[beats.length - 1].trim()}`);
      mismatches.length
        ? bad(`${mismatches.length} MISMATCH line(s) in ${chosen.path} - our model disagreed with the program`)
        : console.log(`  ----  no mismatches logged`);
    } catch (err) {
      // Present but unreadable is not "not running", and saying so would be
      // the same lie in the other direction.
      bad(`${chosen.path} exists but could not be read: ${(err as Error).message}`);
    }
  }

  // THE BAKED FILES THE EMBEDS DRAW FROM. They sit on pages we do not control
  // and nothing rebuilds them on a schedule, so the only thing standing
  // between them and another three weeks is somebody noticing.
  console.log(`\nthe baked public data:`);
  const ages = publicDataAges((path) => {
    try {
      return statSync(path).mtimeMs;
    } catch {
      return null;
    }
  });
  const notes = describePublicDataAges(ages);
  if (notes.length === 0) {
    ok(`all ${ages.length} files rebuilt within a fortnight`);
  } else {
    for (const n of notes) meh(n);
  }

  console.log(`\n${pass} pass, ${fail} fail, ${warn} warn`);
  if (fail) console.log(`SOMETHING IS BROKEN - the FAIL lines say what.`);
  else if (warn) console.log(`Usable. The WARN lines are things that limit what can be run, not breakage.`);
  else console.log(`All good.`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("doctor itself failed:", e.message); process.exit(2); });
