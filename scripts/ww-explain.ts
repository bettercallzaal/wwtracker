/**
 * Why did that fail? Decode a signature, an error code, or a raw RPC error.
 *
 *   npx tsx scripts/ww-explain.ts <signature>
 *   npx tsx scripts/ww-explain.ts 6014
 *   npx tsx scripts/ww-explain.ts '{"InstructionError":[2,{"Custom":6014}]}'
 *
 * Built for use mid-show. A failed trade gives you a signature and nothing
 * else; the wallet says "Transaction failed" and the explorer shows a number.
 * This turns the number into the program's own sentence, and where it can, into
 * the reason THIS trade hit it.
 */
import { b58decode, PROGRAM_ID } from "@/lib/ww/pda";
import { programError, decodeSimulationError, explainSimulationError } from "@/lib/ww/errors";
import { quoteBuy, minimumSpendLamports } from "@/lib/ww/quote";

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const DISC: Record<string, string> = {
  "28ef8a9a08256a6c": "buyShares", b8a4a910e79ec7c4: "sellShares",
  "82831ded86146ef5": "claimShares", "756ca69f9252f6df": "initializeBattle",
  bd54558eb1c83916: "initializeMints", "5091d030b75ca870": "endBattle",
};

/** What a trader should actually do about it, per code. */
const ADVICE: Record<number, string> = {
  6003: "The battle was not active when it landed. Either it had not started or it had ended. The chain's clock lags wall time, so a battle that just opened can reject the first seconds of trading.",
  6006: "An amount the program will not take. On a BUY this is almost always minTokensOut of 0 - zero is rejected, the minimum is 1. On a sell, 0 is allowed, so look at the token amount instead.",
  6008: "The trade was too small to mint a whole token. Tokens mint in steps of 100,000 and the minimum spend RISES as the pool grows. Nothing was taken.",
  6009: "The battle has not settled yet, so there is nothing to claim. endBattle is permissionless - anyone can settle it, including you.",
  6013: "The deadline passed before it landed. Live clients set 91 to 120 seconds; a congested slot can outlast that.",
  6014: "The price moved past your slippage floor between signing and landing. Nothing was taken. Retry with a looser tolerance, or a smaller size.",
  6017: "Nothing to claim on that side - either you held none, or it was already claimed.",
  6012: "The mints already exist for that battle. Launching is two instructions and the second has already run.",
  6011: "That battle id is already in use. Ids are start times; pick another second.",
};

async function rpc(method: string, params: unknown[]) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j: any = await r.json();
  if (j.error) throw new Error(`${j.error.code} ${j.error.message}`);
  return j.result;
}

function explainCode(code: number, where?: number) {
  const e = programError(code);
  console.log(`\nerror ${code}${where !== undefined ? ` on instruction ${where}` : ""}`);
  if (!e) {
    console.log(`  NOT a WaveWarZ error code. Codes below 6000 are Anchor's or the runtime's,`);
    console.log(`  so this came from another program in the transaction.`);
    return;
  }
  console.log(`  ${e.name} - ${e.message}`);
  if (ADVICE[code]) console.log(`\n  ${ADVICE[code]}`);
  if ((e as any).observed) console.log(`\n  seen before: ${(e as any).observed}`);
}

async function explainSignature(sig: string) {
  const tx = await rpc("getTransaction", [sig, { maxSupportedTransactionVersion: 0, encoding: "json" }]);
  if (!tx) { console.log("no such transaction, or it is older than the node's history"); return; }
  const keys: string[] = tx.transaction.message.accountKeys ?? [];
  const la = tx.meta?.loadedAddresses;
  const all = [...keys, ...(la?.writable ?? []), ...(la?.readonly ?? [])];
  const logs: string[] = tx.meta?.logMessages ?? [];

  console.log(`\nsignature ${sig.slice(0, 20)}...`);
  console.log(`  slot ${tx.slot}   ${tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : "no blockTime"}`);
  console.log(`  fee payer ${all[0]}`);

  const ours = tx.transaction.message.instructions
    .map((ix: any, i: number) => ({ i, ix }))
    .filter((x: any) => all[x.ix.programIdIndex] === PROGRAM_ID);
  console.log(`\n  WaveWarZ instructions in it: ${ours.length}`);
  for (const { i, ix } of ours) {
    const d = b58decode(ix.data);
    const name = DISC[Buffer.from(d.slice(0, 8)).toString("hex")] ?? "unknown";
    let extra = "";
    if ((name === "buyShares" || name === "sellShares") && d.length >= 33) {
      const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
      const amount = Number(v.getBigUint64(8, true));
      const minOut = Number(v.getBigUint64(17, true));
      const deadline = Number(v.getBigInt64(25, true));
      extra = `  amount ${amount.toLocaleString()}  side ${d[16] ? "A" : "B"}  floor ${minOut.toLocaleString()}` +
        (tx.blockTime ? `  deadline ${deadline - tx.blockTime}s after landing` : "");
      if (minOut === 0 && name === "buyShares") extra += "\n        FLOOR OF 0 ON A BUY - the program rejects that outright";
    }
    console.log(`    [${i}] ${name}${extra}`);
  }

  if (!tx.meta?.err) {
    console.log(`\n  SUCCEEDED.`);
    for (const l of logs.filter((l) => l.includes("Program log:") && !l.includes("Instruction:")))
      console.log(`    ${l.replace("Program log: ", "")}`);
    return;
  }

  console.log(`\n  FAILED: ${JSON.stringify(tx.meta.err)}`);
  const ie = (tx.meta.err as any).InstructionError;
  if (Array.isArray(ie) && typeof ie[1] === "object" && "Custom" in ie[1]) explainCode(ie[1].Custom, ie[0]);
  else if (Array.isArray(ie)) console.log(`  instruction ${ie[0]} failed with ${JSON.stringify(ie[1])}`);
  const anchor = logs.filter((l) => l.includes("AnchorError") || l.includes("Error Message"));
  if (anchor.length) { console.log(`\n  the program's own words:`); for (const l of anchor) console.log(`    ${l.replace("Program log: ", "")}`); }
}

async function main() {
  const a = process.argv[2];
  if (!a) {
    console.log("usage: ww-explain.ts <signature | errorCode | rpcErrorJson>");
    console.log("\nevery WaveWarZ error code:");
    for (let c = 6000; c <= 6027; c++) { const e = programError(c); if (e) console.log(`  ${c}  ${e.name.padEnd(32)} ${e.message}`); }
    return;
  }
  if (/^\d{4}$/.test(a)) return explainCode(Number(a));
  if (a.trim().startsWith("{")) {
    const parsed = JSON.parse(a);
    const decoded = decodeSimulationError(parsed);
    if (!decoded) {
      console.log(`\n${explainSimulationError(parsed)}`);
      return;
    }
    explainCode(decoded.code, decoded.instructionIndex);
    return;
  }
  await explainSignature(a);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
