/**
 * Watch live battles and check our curve against every real trade as it lands.
 *
 *   npx tsx scripts/ww-live-watch.ts               # poll for battles, then watch
 *   npx tsx scripts/ww-live-watch.ts --every 2     # seconds between polls
 *   npx tsx scripts/ww-live-watch.ts --battle ID   # watch one specific battle
 *
 * WHAT IT PROVES, AND WHY IT IS BETTER THAN A SIMULATION. Everything this
 * estate has verified so far was a transaction we built ourselves. This watches
 * trades other people make, with their own money, through their own client, and
 * asks one question per trade: given the pool before, does our quote predict
 * the tokens the program actually minted?
 *
 * IT READS ONLY THE BATTLE ACCOUNT. `getTransaction` is separately rate-limited
 * on the public endpoint and this needs none of it - the account carries pool
 * and supply for both sides, so a change between two polls IS a trade, and the
 * two numbers are enough to check the curve.
 *
 * THE ONE THING IT CANNOT SEE is two trades landing inside one poll interval.
 * Tokens mint in whole steps, so two floored deltas do not sum to the floored
 * total, and a merged interval can disagree with the model for a reason that is
 * not a defect. Those are reported as MERGED and excluded from the tally rather
 * than counted as passes or failures - a wrong denominator is worse than a
 * smaller one.
 */
import { PROGRAM_ID, battlePda } from "@/lib/ww/pda";
import { supplyAtPool } from "@/lib/ww/quote";
import { recordSample, DEFAULT_DIR } from "../lib/poolHistoryStore";
import { shouldRecord, type PoolSample } from "../lib/ww/poolHistory";
import { observe, spendForPoolDelta } from "@/lib/ww/tradeObservation";

const RPC = "https://api.mainnet-beta.solana.com";
const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : d;
};
const EVERY = Number(arg("--every", "3")) * 1000;
const ONE = arg("--battle");
/** Where each battle's pool series is appended, one JSONL per battle. `var/` is gitignored. */
const STORE = arg("--store", DEFAULT_DIR)!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(method: string, params: unknown[]): Promise<any> {
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      if (res.status === 429) { await sleep(700 * (i + 1)); continue; }
      const j = await res.json();
      if (j.error) { await sleep(500 * (i + 1)); continue; }
      return j.result;
    } catch { await sleep(600 * (i + 1)); }
  }
  rpcFailures++;
  return null;
}
let rpcFailures = 0;

const read = (raw: Buffer) => ({
  battleId: Number(raw.readBigUInt64LE(8)),
  startTime: Number(raw.readBigInt64LE(20)),
  endTime: Number(raw.readBigInt64LE(28)),
  supply: { a: Number(raw.readBigUInt64LE(196)), b: Number(raw.readBigUInt64LE(204)) },
  pool: { a: Number(raw.readBigUInt64LE(212)), b: Number(raw.readBigUInt64LE(220)) },
  winnerDecided: raw[245] !== 0,
});
type State = ReturnType<typeof read>;

async function findLive(): Promise<number[]> {
  const accounts: any[] = await rpc("getProgramAccounts", [PROGRAM_ID,
    { encoding: "base64", filters: [{ dataSize: 353 }], dataSlice: { offset: 0, length: 256 } }]) ?? [];
  const now = Math.floor(Date.now() / 1000);
  const live: number[] = [];
  for (const a of accounts) {
    const raw = Buffer.from(a.account.data[0], "base64");
    const s = read(raw);
    if (s.battleId < 1_600_000_000 || s.battleId > 2_600_000_000) continue;
    // Keep a battle until it actually settles, not until the clock runs out.
    // Trades land in the final second and the settle lags the bell by up to a
    // minute: on 2026-09-20 a 7.88 SOL buy hit battle 1789951764 at t-1s, the
    // next poll fell at t+2s, endTime > now was false, the battle left this
    // list, and its last stored state was never compared. That was 8.50 of the
    // 9.58 SOL that moved in that round (11.2% coverage), reported all night
    // as "106 exact, 1 mismatched" because the tally counts what it classified.
    //
    // THE GRACE BOUND IS LOAD-BEARING. `!s.winnerDecided` alone looks right
    // and would subscribe this loop to the 81 battles that sit past end_time
    // permanently unsettled on chain (measured 2026-09-20), every poll.
    const GRACE = 300;
    if (!s.winnerDecided && s.endTime > now - GRACE) live.push(s.battleId);
  }
  return live;
}

async function fetchState(id: number): Promise<State | null> {
  const v = await rpc("getAccountInfo", [battlePda(id), { encoding: "base64" }]);
  return v?.value ? read(Buffer.from(v.value.data[0], "base64")) : null;
}

const stamp = () => new Date().toISOString().slice(11, 19);
let exact = 0, wrong = 0, merged = 0;

/**
 * One side, between two polls. The verdict itself lives in
 * `lib/ww/tradeObservation` so it can be tested; this only prints it.
 *
 * It used to be written out here, closed over these counters, and had never
 * executed once - the tally still read all zeros an hour before the finals. It
 * was going to run for the first time on somebody's real trade.
 */
function compare(id: number, side: "a" | "b", before: State, after: State) {
  const o = observe(
    { poolLamports: before.pool[side], supply: before.supply[side] },
    { poolLamports: after.pool[side], supply: after.supply[side] },
  );
  if (o.kind === "none") return;
  const tag = `${stamp()} ${id} ${side.toUpperCase()}`;
  if (o.exact === true) { exact++; console.log(`${tag} ${o.note}   ours EXACT`); return; }
  if (o.exact === null) { merged++; console.log(`${tag} ${o.note}`); return; }
  wrong++;
  console.log(`${tag} ${o.note}`);
  console.log(`${" ".repeat(9)} pool was ${before.pool[side]}, moved ${o.poolDelta} (spend about ${spendForPoolDelta(o.poolDelta)})`);
}

async function main() {
  console.log(`watching, polling every ${EVERY / 1000}s. Ctrl-C to stop.\n`);
  const seen = new Map<number, State>();
  const lastRecorded = new Map<number, PoolSample>();
  let announcedWait = false;
  // A HEARTBEAT, because silence from a watcher is ambiguous and the ambiguity
  // is the bug. Without it "no trades yet" and "hung on a rate limit" look
  // identical, and the one you need to know about is the second.
  let polls = 0, lastBeat = Date.now();
  const beat = () => {
    if (Date.now() - lastBeat < 60_000) return;
    lastBeat = Date.now();
    console.log(`${stamp()} alive - ${polls} polls, ${rpcFailures} rpc failures, ${exact} exact, ${wrong} mismatched, ${merged} uncountable`);
  };

  for (;;) {
    let ids: number[];
    if (ONE) ids = [Number(ONE)];
    else {
      ids = await findLive();
      if (!ids.length) {
        if (!announcedWait) { console.log(`${stamp()} no live battle yet - still watching`); announcedWait = true; }
        beat();
        await sleep(30_000);   // a full getProgramAccounts - do not hammer it
        continue;
      }
      if (announcedWait) { console.log(`${stamp()} live battles appeared: ${ids.join(", ")}`); announcedWait = false; }
    }

    for (const id of ids) {
      const now = await fetchState(id);
      if (!now) continue;
      const before = seen.get(id);
      // THE STORE. Every poll where a pool or supply moved, plus a heartbeat
      // every 30 s, appended to var/ww-live/<id>.jsonl for the battle page's
      // chart. Until 2026-09-21 the watcher compared and printed and kept
      // nothing anyone could plot. A write failure is logged, never fatal:
      // the verdicts above are the watcher's job, the chart is a bonus.
      const sample: PoolSample = { t: Math.floor(Date.now() / 1000), a: now.pool.a, b: now.pool.b, sa: now.supply.a, sb: now.supply.b };
      if (shouldRecord(lastRecorded.get(id) ?? null, sample)) {
        try { recordSample(STORE, id, sample); lastRecorded.set(id, sample); }
        catch (e) { console.log(`${stamp()} ${id} store write failed: ${(e as Error).message}`); }
      }
      if (!before) {
        const left = now.endTime - Math.floor(Date.now() / 1000);
        console.log(`${stamp()} ${id} joined  pools ${now.pool.a}/${now.pool.b}  supply ${now.supply.a}/${now.supply.b}  ends in ${left}s`);
        console.log(`${stamp()} ${id} curve check on join: A supply ${now.supply.a} vs curve ${Math.floor(supplyAtPool(now.pool.a))}, B ${now.supply.b} vs ${Math.floor(supplyAtPool(now.pool.b))}`);
      } else {
        // Settlement is not a trade: it drains ~90% of the losing pool in one
        // step and compare() would score that as a huge mismatch. Only price
        // the delta while the battle is still open.
        if (!now.winnerDecided) for (const side of ["a", "b"] as const) compare(id, side, before, now);
        if (!before.winnerDecided && now.winnerDecided)
          console.log(`${stamp()} ${id} SETTLED - winner_decided flipped to 1, winner ${now.pool.a >= now.pool.b ? "A" : "B"} by pool`);
      }
      seen.set(id, now);
    }
    polls++;
    beat();
    const total = exact + wrong;
    if (total && total % 10 === 0) console.log(`${stamp()} running tally: ${exact} exact, ${wrong} mismatched, ${merged} uncountable`);
    await sleep(EVERY);
  }
}
main().catch((e) => { console.error(e.message); process.exit(2); });
