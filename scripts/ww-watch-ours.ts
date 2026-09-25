/**
 * Did OUR battle land, and did their indexer see it.
 *
 *   npx tsx scripts/ww-watch-ours.ts <battleId>
 *   npx tsx scripts/ww-watch-ours.ts <battleId> --follow    # re-check every 60s
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT `ww-verify-battle.ts`. That script asks
 * whether our curve model agrees with what the program did. This one asks a
 * different question that nothing answered: after the first battle we launch
 * ourselves, is it REALLY there - account, both mints, a readable phase - and
 * does the listing the rest of the world reads pick it up.
 *
 * The distinction matters because a launch can half-happen. `initializeBattle`
 * and `initializeMints` are two instructions; a battle with an account and no
 * mints is one nobody can trade, and it looks like a live battle from the
 * account alone. That is the same failure shape as everything else here, so it
 * is checked rather than assumed.
 *
 * THE INDEXER QUESTION, AND WHAT THE CHAIN ALREADY ANSWERS. Measured
 * 2026-09-25 over 1,709 chain accounts against their listing of 1,574:
 *
 *   all battles                       135 missing of 1,709   7.90%
 *   started 2026 or later              37 missing of 1,432   2.58%
 *   2026+, and traded at all            0 missing of 1,355   0.00%  (95% upper bound 0.22%)
 *   started before 2026                98 missing of   277  35.38%  <- the control
 *
 * Every single 2026 miss is an UNTRADED battle. None of the 1,355 traded ones
 * is absent.
 *
 * AND MOST OF THOSE MISSES ARE NOT AN INDEXER PROBLEM AT ALL. 39 of the 1,709
 * accounts on chain are HALF-LAUNCHED: `initializeBattle` landed and
 * `initializeMints` never did, so there are no mints and nobody can trade them.
 * They are 2.3% of every battle ever created, 33 of them in 2026, and 0 of 39
 * appear in the listing. Of the 37 missing 2026 battles, 33 are these. The
 * remaining four - 1769048398, 1770433148, 1778290177, 1784773175 - are
 * complete and still absent, and that is the real unexplained residue: four.
 *
 * A HALF-LAUNCH CANNOT HAPPEN FROM OUR PAGE, and that is the point of checking.
 * `launchBattleInstructions` returns both instructions and `LaunchBattle.tsx`
 * puts them in one message, so a Solana transaction's atomicity means both land
 * or neither does. Whatever produced those 39 sent them separately. The mint
 * check below exists anyway, because "we believe it is atomic" and "we looked"
 * are different claims.
 *
 * WHAT NONE OF THIS ESTABLISHES, and one real launch settles: every one of the
 * 1,355 was launched through THEIR front end. The sample contains no battle
 * originated anywhere else. The numbers narrow the question hard - trade on it
 * and history says it shows up - but they do not close it.
 *
 * It reads. It signs nothing, sends nothing and needs no flag.
 */
import { parseBattleAccount, type ProgramAccountRow } from "../lib/ww/discovery";
import { battlePda, mintPda, vaultPda } from "../lib/ww/pda";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const THEIRS = "https://wavewarz.info/api/public/stats";
const args = process.argv.slice(2);
const battleId = Number(args.find((a) => /^\d+$/.test(a)));
const follow = args.includes("--follow");
const dec = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
const SOL = (l: number) => (l / 1e9).toFixed(6);

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error).slice(0, 200)}`);
  return j.result;
}

/** An account that exists, with its size - or null. Absence and failure differ. */
async function accountInfo(pubkey: string): Promise<{ lamports: number; space: number } | null> {
  const r = await rpc("getAccountInfo", [pubkey, { encoding: "base64" }]);
  if (!r || !r.value) return null;
  return { lamports: r.value.lamports, space: r.value.space ?? 0 };
}

async function once(): Promise<boolean> {
  const stamp = new Date().toISOString();
  console.log(`\nbattle ${battleId}, ${stamp}, via ${redactUrl(RPC)}`);

  const battle = battlePda(battleId);
  const vault = vaultPda(battleId);
  const mints = { a: mintPda(battleId, "a"), b: mintPda(battleId, "b") };
  console.log(`  battle pda  ${battle}`);
  console.log(`  vault pda   ${vault}`);

  const [acct, vaultAcct, mintA, mintB] = await Promise.all([
    accountInfo(battle), accountInfo(vault), accountInfo(mints.a), accountInfo(mints.b),
  ]);

  if (!acct) {
    console.log(`  NOT ON CHAIN. No account at the battle PDA - initializeBattle has not landed.`);
    return false;
  }
  console.log(`  account      EXISTS, ${acct.space} bytes, ${SOL(acct.lamports)} SOL rent`);
  console.log(`  vault        ${vaultAcct ? `${SOL(vaultAcct.lamports)} SOL` : "MISSING"}`);

  // The half-launch check. Two instructions, and only the first is visible from
  // the battle account, so a battle nobody can trade reads as a live one.
  const bothMints = Boolean(mintA && mintB);
  console.log(`  mint A       ${mintA ? `exists (${mintA.space} bytes)` : "MISSING"}`);
  console.log(`  mint B       ${mintB ? `exists (${mintB.space} bytes)` : "MISSING"}`);
  if (!bothMints) {
    console.log(`  HALF-LAUNCHED: the account is there and the mints are not. Nobody can trade this.`);
    console.log(`  initializeMints has not landed. The battle is not usable until it does.`);
  }

  // Decode through the same path the rest of the app uses, so this cannot drift
  // from what the site shows - but against THIS account only. Sweeping all
  // 1,700 program accounts to find one we already hold the address of is a
  // 600 KB response for no reason, and public RPC endpoints rate-limit on size.
  const raw = await rpc("getAccountInfo", [battle, { encoding: "base64" }]);
  const row: ProgramAccountRow | null = raw?.value?.data?.[0]
    ? { pubkey: battle, account: { data: raw.value.data as [string, string] } }
    : null;
  const decoded = row ? parseBattleAccount(row, dec) : null;
  if (decoded) {
    const pool = decoded.poolLamports;
    console.log(`  phase        ${decoded.phase}`);
    console.log(`  pools        A ${SOL(pool.a)} SOL   B ${SOL(pool.b)} SOL`);
    console.log(`  settled      ${decoded.settled}${decoded.settled ? ` (winner ${decoded.settlementWinner})` : ""}`);
    console.log(`  starts       ${new Date(decoded.startTime * 1000).toISOString()}`);
    console.log(`  ends         ${new Date(decoded.endTime * 1000).toISOString()}`);
    if (decoded.poolDisagreesWithBalance) {
      console.log(`  NOTE: the stored pool and the stored balance disagree - expected after a sell, see lib/ww/quote.ts`);
    }
    const traded = pool.a + pool.b > 0;
    console.log(`  traded       ${traded ? "yes" : "NO - and an untraded battle is the one profile their indexer misses (37 of 77 in 2026)"}`);
  } else {
    console.log(`  could not decode the account - it exists but is not a battle this build recognises`);
  }

  // Their side. The totals endpoint is public and needs no key; it moves on a
  // 60s cache, so a battle will not appear the instant it lands.
  try {
    const r = await fetch(THEIRS, { headers: { "User-Agent": "wwtracker-watch/1.0" } });
    const j: any = await r.json();
    console.log(`  their stats  total ${j.battles?.total}, community ${j.battles?.communityBattles}, as of ${j.updatedAt}`);
    console.log(`               (a count, not a lookup - it tells you their total moved, not that ours is in it)`);
  } catch (e) {
    console.log(`  their stats  unreachable: ${(e as Error).message}`);
  }
  return bothMints;
}

(async () => {
  if (!Number.isFinite(battleId)) {
    console.error("usage: npx tsx scripts/ww-watch-ours.ts <battleId> [--follow]");
    process.exit(2);
  }
  if (!follow) { await once(); return; }
  for (;;) {
    await once().catch((e) => console.log(`  check failed: ${(e as Error).message}`));
    await new Promise((r) => setTimeout(r, 60_000));
  }
})();
