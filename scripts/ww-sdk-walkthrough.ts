/**
 * The whole loop, using ONLY what `lib/ww` exports.
 *
 * WHY THIS EXISTS. The SDK has been built module by module and every module has
 * tests, but nothing had ever run the sequence an integrator actually runs:
 * find a battle, read it, quote a trade, build the instruction, and stop at the
 * signature. A library can pass 875 tests and still be unusable because the
 * pieces do not meet.
 *
 * THE RULE THIS FILE OBEYS, and it is the whole point: it imports from
 * `@/lib/ww` and from nothing else in this repo. Every time it needs something
 * that index does not export, that is a gap in the SDK rather than a thing to
 * work around here. Gaps found this way are listed at the bottom.
 *
 * IT STOPS BEFORE SIGNING. It prints the instruction it would send and exits.
 * No key is read, none is held, and the one thing this repo must never do by
 * accident is sign something.
 *
 *   npx tsx scripts/ww-sdk-walkthrough.ts
 */
import {
  battleDiscoveryRequest,
  parseBattleAccounts,
  awaitingSettlement,
  settledWithValue,
  phaseCounts,
  battleAccountsFromRaw,
  battleStateFromRaw,
  planBuy,
  planSell,
  quoteBuy,
  quoteSell,
  feeSplit,
  lamportsToSol,
  solToLamports,
  verifyBattleRecord,
  buildBattleRecord,
  battlePda,
  PROGRAM_ID,
  type BattleState,
  type BattleSummary,
} from "@/lib/ww";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

async function rpc<T>(body: unknown): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rpc ${res.status}`);
  const j = (await res.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

const sol = (lamports: number) => `${lamportsToSol(lamports).toFixed(4)} SOL`;

async function main() {
  console.log("1. FIND BATTLES  (the SDK builds the request, we do the fetch)\n");
  const rows = await rpc<Array<{ pubkey: string; account: { data: [string, string] } }>>(
    battleDiscoveryRequest(),
  );
  const battles = parseBattleAccounts(rows, b64);
  const counts = phaseCounts(battles);
  console.log(`   ${rows.length} accounts returned, ${battles.length} are battles`);
  console.log(`   live ${counts.live}   awaiting settlement ${counts["awaiting-settlement"]}   settled ${counts.settled}`);

  const stuck = awaitingSettlement(battles);
  if (stuck.length) {
    console.log(`\n   oldest unsettled: ${stuck[0].battleId}, ended ${new Date(stuck[0].endTime * 1000).toISOString().slice(0, 10)}`);
  }

  const rich = settledWithValue(battles);
  const target: BattleSummary = rich[0];
  console.log(`\n2. PICK ONE  -> ${target.battleId}`);
  console.log(`   pools ${sol(target.poolLamports.a)} / ${sol(target.poolLamports.b)}`);
  console.log(`   settled ${target.settled}, program settled on ${target.settlementWinner}`);

  console.log(`\n3. READ IT IN FULL  (discovery slices to 256 bytes; a record needs all 353)`);
  const full = await rpc<{ value: { data: [string, string] } | null }>({
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [target.pubkey, { encoding: "base64" }],
  });
  if (!full.value) throw new Error("account vanished between calls");
  const account = b64(full.value.data[0]);
  const accounts = battleAccountsFromRaw(account);
  console.log(`   artist A ${accounts.artistA}`);
  console.log(`   artist B ${accounts.artistB}`);

  console.log(`\n4. VERIFY THE ADDRESS  (a record can name any string)`);
  const derived = battlePda(target.battleId);
  console.log(`   derived from the id: ${derived}`);
  console.log(`   the account we read: ${target.pubkey}`);
  console.log(`   match: ${derived === target.pubkey ? "yes" : "NO - something is wrong"}`);

  console.log(`\n5. BUILD A RECORD, THEN VERIFY IT AGAINST THE SAME BYTES`);
  const record = buildBattleRecord({
    battlePda: target.pubkey,
    programId: PROGRAM_ID,
    account,
  });
  const report = verifyBattleRecord({ record, account });
  console.log(`   verdict: ${report.verdict}`);
  console.log(`   ${report.answered} fields the chain could answer, ${report.unanswered} it could not`);

  console.log(`\n6. QUOTE A TRADE  (nothing is sent)`);
  const spend = solToLamports(0.05);
  const pool = target.poolLamports.a;
  const buy = quoteBuy(pool, spend);
  const fees = feeSplit(buy.feeLamports);
  console.log(`   spending ${sol(spend)} on side A of a ${sol(pool)} pool`);
  console.log(`   tokens out about ${Math.floor(buy.tokensOut).toLocaleString()}`);
  console.log(`   fee ${sol(buy.feeLamports)}  ->  artist ${sol(fees.artistLamports)}, platform ${sol(fees.platformLamports)}`);

  const back = quoteSell(buy.poolAfterLamports, buy.tokensOut);
  console.log(`   selling straight back: vault releases ${sol(back.grossLamports)}, you receive ${sol(back.lamportsOut)}`);
  console.log(`   round trip costs ${(100 * (1 - back.lamportsOut / spend)).toFixed(2)}%  (the 1.5% fee, twice)`);

  console.log(`\n7. PLAN A BUY  (fresh read, slippage floor, price-impact limit)`);
  // Was six lines of hand-decoded byte offsets until this script was written.
  // `battleStateFromRaw` exists because of that; see the gap list at the bottom.
  const readBattleState = async (): Promise<BattleState> => {
    const again = await rpc<{ value: { data: [string, string] } | null }>({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [target.pubkey, { encoding: "base64" }],
    });
    return battleStateFromRaw(b64(again.value!.data[0]));
  };
  const plan = await planBuy({
    battleId: target.battleId,
    trader: accounts.artistA, // any address; nothing is signed
    side: "a",
    amountLamports: spend,
    slippageBps: 100,
    deadlineSeconds: 60,
    readBattleState,
    maxPriceImpactBps: 500,
  });
  console.log(`   pool the floor was computed against: ${sol(plan.poolLamports)}`);
  console.log(`   floor in the instruction: ${Math.floor(plan.minTokensOut).toLocaleString()} tokens`);
  console.log(`   price impact ${plan.priceImpact.impactBps} bps, checked against a limit: ${plan.priceImpact.checked}`);
  console.log(`   instruction: ${plan.instruction.keys.length} accounts, ${plan.instruction.data.length} bytes of data`);

  console.log(`\n8. STOP.  A wallet signs from here. This script holds no key and sends nothing.`);
}

/**
 * GAPS THIS SCRIPT FOUND, which is what it was for.
 *
 * 1. NO WAY TO BUILD A `BattleState` FROM AN ACCOUNT. Both planners require
 *    one and the only route was hand-decoding two u64s at offsets 212 and 220,
 *    so an integrator had to know byte offsets the library otherwise keeps to
 *    itself. Fixed: `battleStateFromRaw` is exported.
 *
 * 2. `planSell` WAS NEVER ON THE EXPORTED SURFACE. It was built, tested and
 *    documented in #315 and `lib/ww/index.ts` only ever exported `planBuy`, so
 *    the sell planner was unreachable from outside this repo. Fixed in the
 *    same commit. Nothing failed, because nothing outside the repo had tried.
 *
 * Both were invisible to 875 passing tests, because every test imports the
 * module directly rather than through the front door an integrator uses.
 */

main().catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
