#!/usr/bin/env tsx
/**
 * Can WE launch a battle, or only the platform.
 *
 *   npx tsx scripts/ww-launch-dry-run.ts
 *   npx tsx scripts/ww-launch-dry-run.ts --creator <pubkey> --duration 600
 *
 * THE QUESTION THIS ANSWERS. `initializeBattle` takes an account named `admin`
 * that must sign. `instructions.ts` says "any wallet" in a comment, and that
 * comment has never been checked against the program: every battle on chain
 * was created by the platform treasury, which is equally consistent with "only
 * they can" and "only they do". The IDL's 28 custom errors contain no
 * Unauthorized, but an Anchor address constraint fails from the framework's
 * own error range and would not appear there. So the comment is a belief.
 *
 * Simulation settles it. `endBattle` was proved the same way before anyone
 * signed 82 of them (`ww-settle-dry-run.ts`): `sigVerify: false` runs the real
 * program against real chain state with no wallet, no key and no signature.
 *
 * IT SIGNS NOTHING AND SENDS NOTHING. The creator is a public key the
 * simulator needs to balance the message; it is never asked for a signature
 * and no lamports move.
 */
import {
  buySharesInstruction,
  launchBattleInstructions,
  traderTokenAccountInstructions,
} from "../lib/ww/instructions";
import { battlePda, vaultPda, mintPda } from "../lib/ww/pda";
import { canAfford, checkLaunch, launchCost, LAUNCH_ACCOUNTS } from "../lib/ww/launchPlan";
import { computeUnitLimitInstruction, serializeMessage } from "../lib/ww/message";
import { unsignedTransaction } from "../lib/ww/wallet";
import { TREASURY_WALLET } from "../lib/config";
import { optionValue } from "../lib/cliArgs";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const args = process.argv.slice(2);
/** Zaal's trader wallet: public, funded, and emphatically not the treasury. */
const CREATOR = optionValue(args, "--creator", "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk");
const ARTIST_A = optionValue(args, "--artist-a", CREATOR);
const ARTIST_B = optionValue(args, "--artist-b", CREATOR);
const DURATION = Number(optionValue(args, "--duration", "600"));
/**
 * Also buy into the battle being created, in the SAME transaction.
 *
 * Instructions in one transaction run in order against the state the previous
 * one left, so a buy here executes against a battle that did not exist when
 * the transaction was submitted. That is the only way to prove "we can launch
 * a battle AND trade it" without first spending real SOL on a battle that
 * might turn out to be untradeable.
 */
const WITH_TRADE_SOL = Number(optionValue(args, "--with-trade", "0"));
/**
 * Seconds from now to the battle's start. The id IS the start time.
 *
 * DEFAULT 0 WHEN TRADING, AND THE REASON IS A REAL FAILURE. The first run of
 * `--with-trade` put the start 300 seconds ahead and the buy failed with
 * `BattleNotActive` (6003): a battle cannot be traded before it starts, which
 * is obvious afterwards. A launch-and-trade proof has to put the start at now.
 */
const STARTS_IN = Number(optionValue(args, "--starts-in", WITH_TRADE_SOL > 0 ? "0" : "300"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(method: string, params: unknown[]): Promise<any> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).catch(() => null);
    if (!res) { await sleep(800 * (i + 1)); continue; }
    if (res.status === 429) { await sleep(900 * (i + 1)); continue; }
    const j = await res.json().catch(() => null);
    if (!j) { await sleep(700 * (i + 1)); continue; }
    if (j.error) throw new Error(`${method}: ${j.error.message}`);
    return j.result;
  }
  throw new Error(`${method} failed after 6 attempts`);
}

async function main() {
  console.log(`launch dry run, ${new Date().toISOString()}, via ${redactUrl(RPC)}`);

  // A battle id IS its start time in unix seconds. A few minutes ahead, so the
  // id is certainly unused and the accounts certainly do not exist yet - which
  // is the state a real launch runs in.
  const battleId = Math.floor(Date.now() / 1000) + STARTS_IN;
  const battle = battlePda(battleId);
  const vault = vaultPda(battleId);
  console.log(`\nbattle id ${battleId} (start ${new Date(battleId * 1000).toISOString()}), duration ${DURATION}s`);
  console.log(`  battle  ${battle}`);
  console.log(`  vault   ${vault}`);
  console.log(`  mint a  ${mintPda(battleId, "a")}`);
  console.log(`  mint b  ${mintPda(battleId, "b")}`);
  console.log(`  creator ${CREATOR}${CREATOR === TREASURY_WALLET ? "  (THE TREASURY - this proves nothing about anyone else)" : "  (not the treasury)"}`);

  // The accounts must not already exist, or a clean simulation would only mean
  // the id was taken.
  const existing = await rpc("getMultipleAccounts", [[battle, vault], { encoding: "base64" }]);
  const taken = (existing.value ?? []).filter((v: unknown) => v !== null).length;
  if (taken > 0) {
    console.log(`\nSTOPPING: ${taken} of the 2 accounts already exist, so this id is not fresh.`);
    process.exit(1);
  }
  console.log("  both accounts are unused, so this is a real first launch");

  const balance = await rpc("getBalance", [CREATOR]);
  console.log(`  creator balance ${(balance.value / 1e9).toFixed(4)} SOL`);

  // Through the same checker the launch screen uses, so a shape the screen
  // would refuse cannot be proved sound here.
  const check = checkLaunch(
    { battleId, durationSeconds: DURATION, artistA: ARTIST_A, artistB: ARTIST_B },
    Math.floor(Date.now() / 1000),
  );
  if (!check.ok) {
    console.log(`\nSTOPPING: ${check.reason}`);
    process.exit(1);
  }

  const ixs = [computeUnitLimitInstruction(400_000), ...launchBattleInstructions({
    battleId, creator: CREATOR, artistA: ARTIST_A, artistB: ARTIST_B,
    wavewarzWallet: TREASURY_WALLET, durationSeconds: DURATION,
  })];

  if (WITH_TRADE_SOL > 0) {
    const lamports = Math.round(WITH_TRADE_SOL * 1e9);
    // The two token accounts first: the WaveWarZ program does not create them,
    // so a first-time trader's buy needs them in the same transaction. They are
    // idempotent, so they cost nothing if they somehow already exist.
    ixs.push(...traderTokenAccountInstructions(battleId, CREATOR));
    ixs.push(buySharesInstruction({
      battleId,
      trader: CREATOR,
      // Known because we are choosing them; no account read is possible for a
      // battle this transaction has not created yet.
      battle: { artistA: ARTIST_A, artistB: ARTIST_B, wavewarzWallet: TREASURY_WALLET },
      artistA: true,
      amountLamports: lamports,
      // A real floor, not 0. A buy with minTokensOut 0 is rejected by the
      // program outright (InvalidAmount 6006), so 0 would test nothing.
      minTokensOut: 1,
      deadline: battleId + DURATION,
    }));
    console.log(`\nand buying ${WITH_TRADE_SOL} SOL of side A in the SAME transaction, against a battle that does not exist yet`);
  }
  const { blockhash } = (await rpc("getLatestBlockhash", [{ commitment: "finalized" }])).value;
  const message = serializeMessage(CREATOR, blockhash, ixs);
  const tx = Buffer.from(unsignedTransaction(message)).toString("base64");
  console.log(`\n${ixs.length} instructions, message ${message.length} bytes, transaction ${tx.length} base64 chars`);

  const sim = await rpc("simulateTransaction", [tx, {
    sigVerify: false, replaceRecentBlockhash: true, commitment: "processed", encoding: "base64",
  }]);
  const logs: string[] = sim.value?.logs ?? [];
  console.log("\nprogram log:");
  for (const l of logs) console.log(`  ${l}`);

  if (sim.value?.err) {
    console.log(`\nWOULD FAIL: ${JSON.stringify(sim.value.err)}`);
    // WHICH INSTRUCTION FAILED, because the first version of this said "so
    // this wallet cannot launch a battle" for a failure in the BUY - the
    // launch had succeeded two instructions earlier and the log said so. A
    // failure attributed to the wrong instruction is worse than an unexplained
    // one: it produces a confident wrong conclusion, in this case that the
    // program is permissioned when it is not.
    const err = sim.value.err as { InstructionError?: [number, unknown] };
    const index = Array.isArray(err?.InstructionError) ? err.InstructionError[0] : null;
    const launchRan = logs.some((l) => l.includes("Battle initialized with ID"));
    const mintsRan = logs.some((l) => l.includes("Mints initialized for battle"));
    if (index !== null) {
      const what =
        index < ixs.length
          ? index === 0
            ? "the compute budget instruction"
            : index === 1
              ? "initializeBattle"
              : index === 2
                ? "initializeMints"
                : index < ixs.length - 1
                  ? "an associated-token-account creation"
                  : "buyShares"
          : "an instruction past the end of this transaction";
      console.log(`  the failure is at instruction ${index}, which is ${what}`);
    }
    console.log(`  initializeBattle ran: ${launchRan ? "YES" : "no"}`);
    console.log(`  initializeMints ran:  ${mintsRan ? "YES" : "no"}`);
    if (launchRan && mintsRan) {
      console.log("  So LAUNCHING is not what failed. Read the program error above for what did.");
    } else {
      console.log("  The launch itself did not complete, so this wallet may not be able to launch.");
    }
    process.exit(2);
  }
  console.log(`\nWOULD SUCCEED. units consumed: ${sim.value?.unitsConsumed ?? "unknown"}`);
  if (WITH_TRADE_SOL > 0) {
    // The claim is only as good as the evidence that the buy RAN. A clean
    // simulation of a transaction whose buy was silently dropped would look
    // identical, which is the shape this repo keeps finding.
    const bought = logs.some((l) => l.includes("Instruction: BuyShares"));
    console.log(
      bought
        ? "The buy executed against the battle this same transaction created."
        : "BUT NO BuyShares INSTRUCTION RAN. The launch succeeded and the trade did not appear in the log.",
    );
    if (!bought) process.exit(2);
  }

  // WHAT IT COSTS, via the same module the launch screen uses, so the number
  // quoted here and the number quoted to a signer cannot drift apart. Rent is
  // asked of the cluster rather than assumed.
  const rentFor = new Map<number, number>();
  for (const { bytes } of LAUNCH_ACCOUNTS) {
    if (rentFor.has(bytes)) continue;
    rentFor.set(bytes, await rpc("getMinimumBalanceForRentExemption", [bytes]));
  }
  const fee = await rpc("getFeeForMessage", [Buffer.from(message).toString("base64"), { commitment: "processed" }]);
  const cost = launchCost(rentFor, typeof fee?.value === "number" ? fee.value : null);

  console.log("\nwhat the creator pays. NONE of this comes back: no instruction closes these accounts.");
  for (const l of cost.lines) {
    console.log(`  ${l.name.padEnd(16)} ${String(l.bytes).padStart(4)} bytes  ${(l.lamports / 1e9).toFixed(6)} SOL`);
  }
  console.log(
    `  network fee                   ${cost.networkFeeLamports === null ? "UNKNOWN (the cluster quoted none)" : `${(cost.networkFeeLamports / 1e9).toFixed(6)} SOL`}`,
  );
  console.log(
    `  TOTAL                         ${(cost.totalLamports / 1e9).toFixed(6)} SOL${cost.isFloor ? "  (a FLOOR: the fee is unknown)" : ""}`,
  );
  const afford = canAfford(balance.value, cost);
  console.log(
    `  creator can afford it:        ${afford === null ? "UNKNOWN (the fee is unknown and the balance is close)" : afford ? "yes" : "NO"}`,
  );

  console.log(`A battle can be launched by ${CREATOR}, which is not the platform treasury.`);
  console.log("Nothing was signed and nothing was sent.");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
