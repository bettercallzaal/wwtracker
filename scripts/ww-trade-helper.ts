/**
 * What you actually get for a given spend, before you click.
 *
 *   npx tsx scripts/ww-trade-helper.ts --battle ID --spend 0.05
 *   npx tsx scripts/ww-trade-helper.ts --live --spend 0.05
 *
 * THREE THINGS THE UI CANNOT TELL YOU, all measured against the program today.
 *
 * 1. TOKENS MINT IN WHOLE STEPS OF 100,000. A spend that lands part-way past a
 *    step buys nothing for the remainder. The waste is silent - you are not
 *    told, the tokens simply are not there. This prints the nearest spend that
 *    lands ON a boundary, so the excess is not thrown away.
 *
 * 2. THE CURVE IS A SQUARE ROOT, so tokens per SOL fall as the pool grows.
 *    Being early on a side is worth more than being right about it late. The
 *    marginal rate is printed beside the average so the two can be compared.
 *
 * 3. SELLS GO OUT WITH NO SLIPPAGE FLOOR on the live client - 31 of 31 sampled
 *    sells carried minSolOut of 0. Buys carry 2% or 7%. So a sell takes
 *    whatever the pool has done by the time it lands, and the deadline window
 *    measured on real trades is 91 to 120 seconds.
 *
 * The settlement winner is whichever side holds the larger POOL, which is not
 * necessarily the side the judges pick. Both are printed.
 */
import { PROGRAM_ID, battlePda } from "@/lib/ww/pda";
import { quoteBuy, quoteSell, minimumSpendLamports, SUPPLY_QUANTUM, poolAtSupply, supplyAtPool, BUY_POOL_SHARE } from "@/lib/ww/quote";

const RPC = "https://api.mainnet-beta.solana.com";
const arg = (n: string, d?: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const SOL = (l: number) => (l / 1e9).toFixed(6);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(method: string, params: unknown[]): Promise<any> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    if (res.status === 429) { await sleep(700 * (i + 1)); continue; }
    const j = await res.json();
    if (j.error) { await sleep(500 * (i + 1)); continue; }
    return j.result;
  }
  return null;
}

/** The cheapest spend that still lands on the next whole step. */
function boundarySpend(pool: number, spend: number): { spend: number; tokens: number } {
  const target = quoteBuy(pool, spend).tokensOut;
  if (target <= 0) return { spend: minimumSpendLamports(pool), tokens: SUPPLY_QUANTUM };
  // Walk down: the smallest spend that still yields the same whole-step total.
  let lo = 1, hi = spend;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (quoteBuy(pool, mid).tokensOut >= target) hi = mid; else lo = mid + 1;
  }
  return { spend: lo, tokens: target };
}

function side(name: string, pool: number, supply: number, spend: number) {
  const q = quoteBuy(pool, spend);
  const b = boundarySpend(pool, spend);
  const waste = spend - b.spend;
  const marginal = quoteBuy(pool + Math.round(spend * BUY_POOL_SHARE), 10_000_000).tokensOut / 0.01;
  console.log(`\n  ${name}`);
  console.log(`    pool ${SOL(pool)} SOL   minted supply ${supply.toLocaleString()}`);
  console.log(`    spending ${SOL(spend)} SOL  ->  ${q.tokensOut.toLocaleString()} tokens`);
  console.log(`      rate now        ${(q.tokensOut / (spend / 1e9)).toFixed(0)} tokens per SOL`);
  console.log(`      rate after      ${marginal.toFixed(0)} tokens per SOL   (what the NEXT buyer gets)`);
  if (waste > 0)
    console.log(`      SAME TOKENS FOR ${SOL(b.spend)} SOL - you would waste ${SOL(waste)} SOL (${((waste / spend) * 100).toFixed(2)}%) buying past the step`);
  else console.log(`      this spend lands on a step boundary already`);
  const nextStep = poolAtSupply(supply + SUPPLY_QUANTUM) - pool;
  console.log(`      minimum that mints anything here: ${SOL(minimumSpendLamports(pool))} SOL`);
  return q;
}

async function main() {
  const spendSol = Number(arg("--spend", "0.05"));
  const spend = Math.round(spendSol * 1e9);
  let id = Number(arg("--battle", "0"));

  if (!id || process.argv.includes("--live")) {
    const accounts: any[] = await rpc("getProgramAccounts", [PROGRAM_ID,
      { encoding: "base64", filters: [{ dataSize: 353 }], dataSlice: { offset: 0, length: 256 } }]) ?? [];
    const now = Math.floor(Date.now() / 1000);
    const live = accounts.map((a) => Buffer.from(a.account.data[0], "base64"))
      .filter((r) => { const bid = Number(r.readBigUInt64LE(8)); return bid > 1_600_000_000 && bid < 2_600_000_000 && Number(r.readBigInt64LE(28)) > now && r[245] === 0; });
    if (!live.length) { console.log("no live battle right now - pass --battle ID to price a specific one"); return; }
    id = Number(live[0].readBigUInt64LE(8));
    console.log(`live battle: ${id}${live.length > 1 ? `  (${live.length} running, showing the first)` : ""}`);
  }

  const v = await rpc("getAccountInfo", [battlePda(id), { encoding: "base64" }]);
  if (!v?.value) { console.log(`battle ${id} has no account`); return; }
  const raw = Buffer.from(v.value.data[0], "base64");
  const endTime = Number(raw.readBigInt64LE(28));
  const left = endTime - Math.floor(Date.now() / 1000);
  const pool = { a: Number(raw.readBigUInt64LE(212)), b: Number(raw.readBigUInt64LE(220)) };
  const supply = { a: Number(raw.readBigUInt64LE(196)), b: Number(raw.readBigUInt64LE(204)) };

  console.log(`\nbattle ${id}   ${left > 0 ? `${Math.floor(left / 60)}m ${left % 60}s left` : "ENDED"}   settled: ${raw[245] !== 0}`);
  console.log(`settlement goes to the LARGER POOL: currently ${pool.a === pool.b ? "TIE (the program settles a tie to B)" : pool.a > pool.b ? "A" : "B"}, by ${SOL(Math.abs(pool.a - pool.b))} SOL`);

  const qa = side("ARTIST A", pool.a, supply.a, spend);
  const qb = side("ARTIST B", pool.b, supply.b, spend);

  console.log(`\n  the same ${SOL(spend)} SOL buys ${qa.tokensOut > qb.tokensOut ? "MORE on A" : qb.tokensOut > qa.tokensOut ? "MORE on B" : "the same on both"}` +
    (qa.tokensOut !== qb.tokensOut ? ` - ${Math.abs(qa.tokensOut - qb.tokensOut).toLocaleString()} tokens difference (${((Math.abs(qa.tokensOut - qb.tokensOut) / Math.min(qa.tokensOut, qb.tokensOut)) * 100).toFixed(1)}%)` : ""));
  console.log(`  it would move that side's pool to ${SOL(qa.poolAfterLamports)} / ${SOL(qb.poolAfterLamports)} SOL`);
  console.log(`\n  fee on this trade: ${SOL(qa.feeLamports)} SOL (1.5%) - the artist gets two thirds of it, the platform one third.`);
  console.log(`  SELLING CARRIES NO FLOOR on the live client, so a sell takes whatever the pool does before it lands.\n`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
