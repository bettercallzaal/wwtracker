/**
 * Replay one battle from chain and check our model against the program's own
 * words, trade by trade.
 *
 *   npx tsx scripts/ww-verify-battle.ts <battleId> [--rpc URL]
 *   npx tsx scripts/ww-verify-battle.ts --live        # every battle running now
 *   npx tsx scripts/ww-verify-battle.ts <battleId> --json   # the rows, for a fixture
 *
 * WHY THIS AND NOT A SIMULATION. Everything verified so far was a transaction
 * this estate built. This reads trades other people made, in the order they
 * landed, and asks whether our quote predicts what the program actually
 * minted - which is the only question a front end's users care about.
 *
 * The program prints its own arithmetic: the fee split, the SOL that reaches
 * the pool, the tokens minted, the SOL returned. So the check needs no account
 * snapshots and no trust in our own bookkeeping. We accumulate the pool from
 * the program's stated contributions and compare our prediction of the NEXT
 * trade against the program's stated result.
 *
 * Exit code 1 if any trade disagrees, so it can gate.
 *
 * `--json` prints one row per buy - the pool it went into, the lamports spent
 * and THE TOKENS THE PROGRAM SAID IT MINTED - so a real trade can become a
 * test fixture. Added 2026-09-24 after this tool found that our quote misses
 * 5 of 24 real trades by exactly one 100,000-token step: a model that has been
 * wrong needs ground truth checked into the repo, not a tool anyone has to
 * re-run against mainnet to discover it again.
 */
import { b58decode, battlePda, PROGRAM_ID } from "@/lib/ww/pda";
import { quoteBuy, quoteBuyAtSupply, quoteSell, feeSplit, TRADE_FEE, BUY_POOL_SHARE, supplyAtPool, poolAtSupply, SUPPLY_QUANTUM } from "@/lib/ww/quote";

const RPC = process.env.SOLANA_RPC_URL_PUBLIC ?? "https://api.mainnet-beta.solana.com";
const DISC = {
  "28ef8a9a08256a6c": "buy",
  b8a4a910e79ec7c4: "sell",
  "82831ded86146ef5": "claim",
  "756ca69f9252f6df": "initializeBattle",
  bd54558eb1c83916: "initializeMints",
  "5091d030b75ca870": "endBattle",
} as Record<string, string>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(method: string, params: unknown[], tries = 10): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (res.status === 429) { await sleep(800 * (i + 1) * (i + 1)); continue; }
    const j = await res.json();
    if (j.error) { await sleep(500 * (i + 1) * (i + 1)); continue; }
    return j.result;
  }
  throw new Error(`rpc ${method} failed after ${tries} tries`);
}

const num = (logs: string[], re: RegExp, nth = 0): number | null => {
  const hits = logs.filter((l) => re.test(l));
  const m = hits[nth]?.match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

interface Row {
  sig: string; slot: number; kind: string; side: "a" | "b";
  amount: number; minOut: number;
  statedToPool: number | null; statedTokens: number | null; statedReturn: number | null;
  statedFee: number | null; statedArtist: number | null; statedPlatform: number | null;
}

async function tradesFor(battleId: number): Promise<Row[]> {
  const pda = battlePda(battleId);
  const sigs: any[] = await rpc("getSignaturesForAddress", [pda, { limit: 1000 }]);
  const rows: Row[] = [];
  for (const s of [...sigs].reverse()) {          // oldest first
    if (s.err) continue;                           // a failed trade moved nothing
    const tx = await rpc("getTransaction", [s.signature, { maxSupportedTransactionVersion: 0, encoding: "json" }]);
    await sleep(Number(process.env.WW_PACE ?? 160));
    if (!tx) continue;
    const keys: string[] = tx.transaction.message.accountKeys ?? [];
    const la = tx.meta?.loadedAddresses;
    const all = [...keys, ...(la?.writable ?? []), ...(la?.readonly ?? [])];
    const logs: string[] = tx.meta?.logMessages ?? [];
    let bi = 0, si = 0;
    for (const ix of tx.transaction.message.instructions) {
      if (all[ix.programIdIndex] !== PROGRAM_ID) continue;
      const d = b58decode(ix.data);
      const kind = DISC[Buffer.from(d.slice(0, 8)).toString("hex")];
      if (kind !== "buy" && kind !== "sell") continue;
      const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
      const side = d[16] ? "a" : "b";
      rows.push({
        sig: s.signature, slot: tx.slot, kind, side,
        amount: Number(v.getBigUint64(8, true)),
        minOut: Number(v.getBigUint64(17, true)),
        statedToPool: num(logs, /SOL for tokens: \d+/, bi),
        statedTokens: num(logs, /Calculated \d+ tokens to mint/, bi),
        statedReturn: num(logs, /SOL to return: \d+/, si),
        statedFee: num(logs, /Total fee: \d+/, kind === "buy" ? bi : si),
        statedArtist: num(logs, /Artist fee: \d+/, kind === "buy" ? bi : si),
        statedPlatform: num(logs, /WaveWarZ fee: \d+/, kind === "buy" ? bi : si),
      });
      if (kind === "buy") bi++; else si++;
    }
  }
  return rows;
}

async function verify(battleId: number, rows: Row[]) {
  const pool = { a: 0, b: 0 };
  const supply = { a: 0, b: 0 };
  const jsonRows: Array<{ battleId: number; side: "a" | "b"; poolLamports: number; supplyBefore: number; spendLamports: number; programTokens: number; signature: string }> = [];
  // AFTER A SELL THE POOL IS DERIVED, NOT OBSERVED. A buy's contribution comes
  // from the program's own log, so the pool stays exact through buys. A sell's
  // does not: this replay subtracts a figure it computed itself, so any error
  // in the sell model moves the pool, and every later buy is then scored
  // against a number nobody observed. Those buys are counted separately rather
  // than reported as mismatches, because a mismatch there cannot tell a wrong
  // buy model from a wrong sell model.
  const derived = { a: false, b: false };
  let checked = 0, bad = 0, unscored = 0;
  // FOUR BUY MODELS, SCORED SIDE BY SIDE, and they must be four DISTINCT
  // functions. Reporting them all on every run is how the next model change
  // gets evidence instead of an argument - but only while each column is its
  // own arithmetic.
  //
  // IT STOPPED BEING FOUR ON 2026-09-24 AND NOBODY NOTICED FOR TWO DAYS. The
  // floor-the-total column called `quoteBuyAtSupply`, which was the
  // floor-the-total model when the line was written and became the
  // from-stored-supply model in #411. So the scoreboard printed the winner
  // twice under two names and scored three models while claiming four. On the
  // three finals it read `floor-the-total 33/37/32` where the real figure is
  // 5/3/2 - it looked like two independent models agreeing, which is the most
  // convincing thing a scoreboard can say and here it was one model's echo.
  //
  // Every column below is now written out as its own expression rather than
  // borrowing a library function, because a library function is free to change
  // meaning under a label that does not.
  const model = { difference: 0, total: 0, endpoints: 0, fromSupply: 0, of: 0 };
  /**
   * THE THIRD FORM: floor the curve at BOTH ends and subtract.
   *
   * It equals floor-the-total on a pool carrying no residual, because there
   * the stored supply IS the floor of the curve. Where sells have left a
   * residual the two part company: this one subtracts the floor at the CURRENT
   * pool rather than the supply actually held, so the residual cancels instead
   * of accumulating.
   */
  const floorQ = (x: number) => Math.floor(x / SUPPLY_QUANTUM) * SUPPLY_QUANTUM;
  const endpoints = (poolLamports: number, spend: number) =>
    floorQ(supplyAtPool(poolLamports + spend * BUY_POOL_SHARE)) - floorQ(supplyAtPool(poolLamports));
  /**
   * THE SECOND FORM: floor the TOTAL supply the observed pool implies, then
   * subtract the supply actually stored.
   *
   * The difference from the fourth form is one term and it is the whole
   * argument of #411: this starts from the pool the VAULT HOLDS, that one from
   * the pool the STORED SUPPLY IMPLIES. On a side that has never sold they are
   * the same number. After a sell the vault carries a residual no token
   * represents and they diverge, which is why this scores 5, 3 and 2 on the
   * three finals and the fourth form scores 33, 37 and 32.
   */
  const floorTheTotal = (poolLamports: number, storedSupply: number, spend: number) =>
    floorQ(supplyAtPool(poolLamports + spend * BUY_POOL_SHARE)) - storedSupply;
  /**
   * THE FOURTH FORM: price from the pool the STORED SUPPLY implies, not the
   * pool the vault holds.
   *
   * Flooring the supply leaves lamports in the pool that no token represents,
   * and a sell removes only the curve value of what it burned - so the two
   * drift apart, by 3 to 43 steps on sides that have sold. Every model tried
   * so far prices off the actual pool and therefore carries that residual into
   * the answer. If the program instead derives its own pool from the supply it
   * stores, the residual never enters the arithmetic at all, which is exactly
   * the shape of the failures: fine until a sell, wrong after one.
   */
  const fromStoredSupply = (storedSupply: number, spend: number) =>
    floorQ(supplyAtPool(poolAtSupply(storedSupply) + spend * BUY_POOL_SHARE)) - storedSupply;
  const fail = (sig: string, what: string, ours: unknown, theirs: unknown) => {
    bad++;
    console.log(`  MISMATCH ${what}\n     ours ${ours}   program ${theirs}\n     ${sig}`);
  };

  for (const r of rows) {
    if (r.kind === "buy") {
      if (r.statedTokens === null) continue;
      const q = quoteBuy(pool[r.side], r.amount);
      if (derived[r.side]) {
        unscored++;
        jsonRows.push({
          battleId, side: r.side, poolLamports: pool[r.side], supplyBefore: supply[r.side],
          spendLamports: r.amount, programTokens: r.statedTokens, signature: r.sig,
        });
        pool[r.side] += r.statedToPool ?? Math.round(r.amount * BUY_POOL_SHARE);
        supply[r.side] += r.statedTokens;
        continue;
      }
      checked++;
      model.of++;
      if (q.tokensOut === r.statedTokens) model.difference++;
      if (floorTheTotal(pool[r.side], supply[r.side], r.amount) === r.statedTokens) model.total++;
      if (endpoints(pool[r.side], r.amount) === r.statedTokens) model.endpoints++;
      if (fromStoredSupply(supply[r.side], r.amount) === r.statedTokens) model.fromSupply++;
      if (q.tokensOut !== r.statedTokens) fail(r.sig, `buy tokens (${r.amount} lamports into pool ${pool[r.side]})`, q.tokensOut, r.statedTokens);
      if (r.statedToPool !== null && Math.round(r.amount * BUY_POOL_SHARE) !== r.statedToPool)
        fail(r.sig, "pool contribution", Math.round(r.amount * BUY_POOL_SHARE), r.statedToPool);
      if (r.statedFee !== null && Math.round(r.amount * TRADE_FEE) !== r.statedFee)
        fail(r.sig, "fee", Math.round(r.amount * TRADE_FEE), r.statedFee);
      if (r.statedFee !== null && r.statedArtist !== null) {
        const split = feeSplit(r.statedFee);
        if (split.artistLamports !== r.statedArtist) fail(r.sig, "artist share", split.artistLamports, r.statedArtist);
        if (r.statedPlatform !== null && split.platformLamports !== r.statedPlatform)
          fail(r.sig, "platform share", split.platformLamports, r.statedPlatform);
      }
      jsonRows.push({
        battleId,
        side: r.side,
        poolLamports: pool[r.side],
        // THE SUPPLY THE SIDE HELD, tracked through sells as well as buys. A
        // fixture that omitted it would force a reader to reconstruct it by
        // summing buys, which is wrong on any battle that had a sell - and
        // that is exactly the battle worth testing.
        supplyBefore: supply[r.side],
        spendLamports: r.amount,
        programTokens: r.statedTokens,
        signature: r.sig,
      });
      pool[r.side] += r.statedToPool ?? Math.round(r.amount * BUY_POOL_SHARE);
      supply[r.side] += r.statedTokens;
    } else {
      if (r.statedReturn === null) continue;
      checked++;
      const q = quoteSell(pool[r.side], r.amount, supply[r.side]);
      if (Math.round(q.lamportsOut) !== r.statedReturn)
        fail(r.sig, `sell proceeds (${r.amount} tokens from supply ${supply[r.side]})`, Math.round(q.lamportsOut), r.statedReturn);
      // THE POOL STAYS OBSERVED THROUGH A SELL WHEN THE PROGRAM SAID BOTH
      // HALVES. It logs the SOL returned and the fee, and the gross that left
      // the pool is their sum - so nothing here has to be inferred from our
      // own sell model. Using our figure instead was what put the pool beyond
      // observation and made every later buy unscorable.
      if (r.statedReturn !== null && r.statedFee !== null) {
        pool[r.side] -= r.statedReturn + r.statedFee;
      } else {
        // One of the two was missing from the log. Now the pool IS derived,
        // and saying so is the whole point.
        pool[r.side] -= Math.round(q.grossLamports);
        derived[r.side] = true;
      }
      supply[r.side] -= r.amount;
    }
  }
  if (process.argv.includes("--json")) {
    // The rows only. Anything else on stdout would have to be stripped before
    // this could be redirected into a fixture file.
    console.log(JSON.stringify(jsonRows, null, 2));
    return { checked, bad };
  }
  console.log(`battle ${battleId}: ${rows.length} trades, ${checked} checked, ${bad} mismatched` +
    (unscored > 0 ? `, ${unscored} UNSCORED (the program did not log both halves of a sell)` : "") +
    (checked === 0 ? "   NOTHING CHECKED - no denominator" : bad === 0 ? "   ALL EXACT" : ""));
  // DOES THE REPLAY'S OWN BOOKKEEPING SURVIVE? Every mismatch above is a
  // comparison against a pool and a supply this function accumulated. The
  // program stores both, so the final values are checkable: if the replay's
  // numbers do not land on the account's, the pool it was quoting against
  // drifted and the mismatch count is not evidence of anything.
  //
  // This was added after two of our own tools disagreed about the finals - the
  // live watcher reporting every trade exact where this reported nine wrong -
  // with no way to tell which was reading a wrong number.
  try {
    const acct = await rpc("getAccountInfo", [battlePda(battleId), { encoding: "base64" }]);
    const raw = acct.value ? Buffer.from(acct.value.data[0], "base64") : null;
    if (!raw || raw.length < 244) {
      console.log("  bookkeeping: UNCHECKED - no readable account, so the counts above stand unverified");
    } else {
      const u = (o: number) => Number(raw.readBigUInt64LE(o));
      const chain = { supplyA: u(196), supplyB: u(204), poolA: u(228), poolB: u(236) };
      const drift = {
        poolA: pool.a - chain.poolA,
        poolB: pool.b - chain.poolB,
        supplyA: supply.a - chain.supplyA,
        supplyB: supply.b - chain.supplyB,
      };
      const off = Object.entries(drift).filter(([, v]) => v !== 0);
      if (off.length === 0) {
        console.log("  bookkeeping: the replay lands exactly on the account's pools and supplies");
      } else {
        // Settlement moves the pools after the last trade, so a settled battle
        // is expected to differ there. Supply is not touched by settling.
        const settled = raw[245] !== 0;
        const supplyOff = off.filter(([k]) => k.startsWith("supply"));
        console.log(
          `  bookkeeping: DRIFT ${off.map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`).join(", ")}` +
            (settled && supplyOff.length === 0
              ? "  (pools only, on a settled battle - settlement moves them after the last trade)"
              : "  - THE COUNTS ABOVE ARE NOT EVIDENCE; the replay was quoting against numbers the program did not hold"),
        );
      }
    }
  } catch (e) {
    console.log(`  bookkeeping: UNCHECKED - ${(e as Error).message}`);
  }

  if (model.of > 0) {
    console.log(
      `  buy models over ${model.of} buys: floor-the-difference ${model.difference}, ` +
        `floor-the-total ${model.total}, floor-both-endpoints ${model.endpoints}, ` +
        `from-stored-supply ${model.fromSupply}`,
    );
  }
  return { checked, bad };
}

async function main() {
  const args = process.argv.slice(2);
  let ids: number[] = [];
  if (args[0] === "--live") {
    const accounts: any[] = await rpc("getProgramAccounts", [PROGRAM_ID,
      { encoding: "base64", filters: [{ dataSize: 353 }], dataSlice: { offset: 0, length: 256 } }]);
    const now = Math.floor(Date.now() / 1000);
    for (const a of accounts) {
      const raw = Buffer.from(a.account.data[0], "base64");
      const id = Number(raw.readBigUInt64LE(8));
      if (id < 1_600_000_000 || id > 2_600_000_000) continue;
      if (Number(raw.readBigInt64LE(28)) > now && raw[245] === 0) ids.push(id);
    }
    console.log(`live battles: ${ids.length}${ids.length ? "" : "  (nothing running)"}`);
  } else {
    ids = args.filter((a) => /^\d+$/.test(a)).map(Number);
  }
  if (!ids.length) { console.log("nothing to verify"); return; }
  let checked = 0, bad = 0;
  for (const id of ids) {
    const rows = await tradesFor(id);
    const r = await verify(id, rows);
    checked += r.checked; bad += r.bad;
  }
  console.log(`\nTOTAL: ${checked} trades checked, ${bad} mismatched`);
  if (!checked) { console.log("MEASUREMENT FAILED - nothing was checked"); process.exit(2); }
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e.message); process.exit(2); });
