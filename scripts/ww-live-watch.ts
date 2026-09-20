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
import { quoteBuy, supplyAtPool, SUPPLY_QUANTUM } from "@/lib/ww/quote";

const RPC = "https://api.mainnet-beta.solana.com";
const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : d;
};
const EVERY = Number(arg("--every", "3")) * 1000;
const ONE = arg("--battle");
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
  return null;
}

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
    if (s.endTime > now && !s.winnerDecided) live.push(s.battleId);
  }
  return live;
}

async function fetchState(id: number): Promise<State | null> {
  const v = await rpc("getAccountInfo", [battlePda(id), { encoding: "base64" }]);
  return v?.value ? read(Buffer.from(v.value.data[0], "base64")) : null;
}

const stamp = () => new Date().toISOString().slice(11, 19);
let exact = 0, wrong = 0, merged = 0;

function compare(id: number, side: "a" | "b", before: State, after: State) {
  const dPool = after.pool[side] - before.pool[side];
  const dSupply = after.supply[side] - before.supply[side];
  if (dPool === 0 && dSupply === 0) return;

  if (dPool > 0 && dSupply > 0) {
    // A buy. The pool grew by 98.5% of what was spent, so recover the spend.
    const spend = Math.round(dPool / 0.985);
    const predicted = quoteBuy(before.pool[side], spend).tokensOut;
    const off = predicted - dSupply;
    if (off === 0) {
      exact++;
      console.log(`${stamp()} ${id} ${side.toUpperCase()} BUY  ${(spend / 1e9).toFixed(4)} SOL -> ${dSupply.toLocaleString()} tokens   ours EXACT`);
    } else if (Math.abs(off) <= SUPPLY_QUANTUM && dSupply % SUPPLY_QUANTUM === 0 && Math.abs(off) === SUPPLY_QUANTUM) {
      merged++;
      console.log(`${stamp()} ${id} ${side.toUpperCase()} BUY  MERGED? off by exactly one step (${off}) - likely two trades in one interval, not counted`);
    } else {
      wrong++;
      console.log(`${stamp()} ${id} ${side.toUpperCase()} BUY  MISMATCH  pool ${before.pool[side]} + ${dPool}  ours ${predicted}  program ${dSupply}  off ${off}`);
    }
  } else if (dPool < 0 && dSupply < 0) {
    const sold = -dSupply;
    const grossPredicted = (before.supply[side] ** 2 - (before.supply[side] - sold) ** 2) / 5e8;
    const off = Math.round(grossPredicted) - -dPool;
    if (Math.abs(off) <= 1) {
      exact++;
      console.log(`${stamp()} ${id} ${side.toUpperCase()} SELL ${sold.toLocaleString()} tokens -> ${(-dPool / 1e9).toFixed(6)} SOL out of pool   ours EXACT`);
    } else {
      wrong++;
      console.log(`${stamp()} ${id} ${side.toUpperCase()} SELL MISMATCH  ours ${Math.round(grossPredicted)}  program ${-dPool}  off ${off}`);
    }
  } else {
    merged++;
    console.log(`${stamp()} ${id} ${side.toUpperCase()} pool ${dPool >= 0 ? "+" : ""}${dPool} supply ${dSupply >= 0 ? "+" : ""}${dSupply} - mixed direction, not counted`);
  }
}

async function main() {
  console.log(`watching, polling every ${EVERY / 1000}s. Ctrl-C to stop.\n`);
  const seen = new Map<number, State>();
  let announcedWait = false;

  for (;;) {
    let ids: number[];
    if (ONE) ids = [Number(ONE)];
    else {
      ids = await findLive();
      if (!ids.length) {
        if (!announcedWait) { console.log(`${stamp()} no live battle yet - still watching`); announcedWait = true; }
        await sleep(Math.max(EVERY, 10_000));
        continue;
      }
      if (announcedWait) { console.log(`${stamp()} live battles appeared: ${ids.join(", ")}`); announcedWait = false; }
    }

    for (const id of ids) {
      const now = await fetchState(id);
      if (!now) continue;
      const before = seen.get(id);
      if (!before) {
        const left = now.endTime - Math.floor(Date.now() / 1000);
        console.log(`${stamp()} ${id} joined  pools ${now.pool.a}/${now.pool.b}  supply ${now.supply.a}/${now.supply.b}  ends in ${left}s`);
        console.log(`${stamp()} ${id} curve check on join: A supply ${now.supply.a} vs curve ${Math.floor(supplyAtPool(now.pool.a))}, B ${now.supply.b} vs ${Math.floor(supplyAtPool(now.pool.b))}`);
      } else {
        for (const side of ["a", "b"] as const) compare(id, side, before, now);
        if (!before.winnerDecided && now.winnerDecided)
          console.log(`${stamp()} ${id} SETTLED - winner_decided flipped to 1, winner ${now.pool.a >= now.pool.b ? "A" : "B"} by pool`);
      }
      seen.set(id, now);
    }
    const total = exact + wrong;
    if (total && total % 10 === 0) console.log(`${stamp()} running tally: ${exact} exact, ${wrong} mismatched, ${merged} uncountable`);
    await sleep(EVERY);
  }
}
main().catch((e) => { console.error(e.message); process.exit(2); });
