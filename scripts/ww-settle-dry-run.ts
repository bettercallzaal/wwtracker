/**
 * Every unsettled battle, packed into transactions, and every one simulated -
 * without a wallet, without the operator flag, and without signing anything.
 *
 *   npx tsx scripts/ww-settle-dry-run.ts
 *   npx tsx scripts/ww-settle-dry-run.ts --fee-payer <pubkey>
 *
 * WHY. The operator page settles the whole list in a handful of approvals
 * (#359). Nobody has run it: it needs WW_OPERATOR on a server and a wallet at
 * the other end, and the first time anyone finds out whether all eleven
 * transactions are accepted would otherwise be while standing in front of
 * Phantom approving them. `endBattle` is permissionless and takes no signer,
 * so the whole plan can be checked against the program with `sigVerify: false`
 * beforehand - which is the same trick the widget's preflight uses, and it
 * costs nothing but RPC calls.
 *
 * It signs nothing and sends nothing. The fee payer is only a public key the
 * simulator needs to balance the message; it is never asked for a signature.
 */
import { battleDiscoveryRequest, parseBattleAccounts, awaitingSettlement, type ProgramAccountRow } from "../lib/ww/discovery";
import { battleAccountsFromRaw, endBattleInstruction } from "../lib/ww/instructions";
import { computeUnitLimitInstruction, computeUnitPriceInstruction, serializeMessage } from "../lib/ww/message";
import { unsignedTransaction } from "../lib/ww/wallet";
import { packSettleBatches, describeBatches } from "../lib/ww/settleBatch";
import { settlePreview } from "../lib/ww/settle";
import { optionValue } from "../lib/cliArgs";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const args = process.argv.slice(2);
/** Any funded mainnet account works; the treasury is used because it is public and always exists. */
const FEE_PAYER = optionValue(args, "--fee-payer", "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37");
const SIZING_BLOCKHASH = "11111111111111111111111111111111";
const PRIORITY = 1_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(method: string, params: unknown[]): Promise<any> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }).catch(() => null);
    if (!res) { await sleep(800 * (i + 1)); continue; }
    if (res.status === 429) { await sleep(900 * (i + 1)); continue; }
    const j = await res.json().catch(() => null);
    if (!j || j.error) { await sleep(700 * (i + 1)); continue; }
    return j.result;
  }
  throw new Error(`${method} failed after 6 attempts`);
}

interface Row { battleId: number; pubkey: string; account: string; poolA: number; poolB: number }

async function main() {
  console.log(`settle dry run, ${new Date().toISOString()}, via ${redactUrl(RPC)}`);
  const rows = (await rpc(battleDiscoveryRequest().method, battleDiscoveryRequest().params)) as ProgramAccountRow[];
  const decode = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
  const all = parseBattleAccounts(rows, decode, Math.floor(Date.now() / 1000));
  // SCANNED vs PARSED, said separately: a row this client cannot decode is not
  // a battle that does not exist, and collapsing the two is how a count starts
  // lying.
  console.log(`accounts read: ${rows.length}, decoded: ${all.length}${rows.length === all.length ? "" : `, UNDECODABLE: ${rows.length - all.length}`}`);
  const byPubkey = new Map(rows.map((r) => [r.pubkey, r.account.data[0]]));
  const waiting: Row[] = awaitingSettlement(all).map((b) => ({
    battleId: b.battleId, pubkey: b.pubkey, account: byPubkey.get(b.pubkey)!,
    poolA: b.poolLamports.a, poolB: b.poolLamports.b,
  }));
  const withMoney = waiting.filter((r) => r.poolA + r.poolB > 0);
  console.log(`awaiting settlement: ${waiting.length}, of which ${withMoney.length} hold anything at all\n`);
  if (waiting.length === 0) { console.log("nothing to settle"); return; }

  // Money first, oldest first, the same order the page uses.
  const ordered = [...waiting].sort((a, b) => Number(a.poolA + a.poolB === 0) - Number(b.poolA + b.poolB === 0) || a.battleId - b.battleId);
  const ixFor = (batch: Row[]) => batch.map((r) => endBattleInstruction({ battleId: r.battleId, battle: battleAccountsFromRaw(decode(r.account)) }));
  const batches = packSettleBatches(ordered, (batch) =>
    serializeMessage(FEE_PAYER, SIZING_BLOCKHASH, [computeUnitLimitInstruction(1_400_000), computeUnitPriceInstruction(PRIORITY), ...ixFor(batch)]).length);
  console.log(describeBatches(batches) + "\n");

  const { blockhash } = await rpc("getLatestBlockhash", [{ commitment: "finalized" }]).then((r: any) => r.value);
  let ok = 0, bad = 0, units = 0;
  for (const [i, batch] of batches.entries()) {
    const msg = serializeMessage(FEE_PAYER, blockhash, [computeUnitLimitInstruction(batch.unitLimit), computeUnitPriceInstruction(PRIORITY), ...ixFor(batch.items)]);
    const sim = await rpc("simulateTransaction", [
      Buffer.from(unsignedTransaction(msg)).toString("base64"),
      { sigVerify: false, replaceRecentBlockhash: true, encoding: "base64" },
    ]);
    const err = sim.value.err;
    const consumed = sim.value.unitsConsumed ?? 0;
    units += consumed;
    const settles = (sim.value.logs ?? []).filter((l: string) => /Battle ended successfully/.test(l)).length;
    if (err) {
      bad++;
      const reason = (sim.value.logs ?? []).find((l: string) => /Error|failed/i.test(l)) ?? JSON.stringify(err);
      console.log(`batch ${i + 1}/${batches.length}  ${String(batch.items.length).padStart(2)} battles  WOULD FAIL  ${reason.slice(0, 120)}`);
    } else {
      ok++;
      console.log(`batch ${i + 1}/${batches.length}  ${String(batch.items.length).padStart(2)} battles  would succeed  ${consumed.toLocaleString()} units, ${settles} settled, ${batch.messageBytes} bytes`);
    }
    await sleep(400);
  }
  const moved = withMoney.reduce((n, r) => n + settlePreview(r.poolA, r.poolB).combinedPoolLamports, 0);
  console.log(`\n${ok} of ${batches.length} batches would succeed${bad ? `, ${bad} WOULD FAIL` : ""}.`);
  console.log(`total compute ${units.toLocaleString()} units across the run; ${(moved / 1e9).toFixed(6)} SOL sits in the pools of the ${withMoney.length} battles that hold anything.`);
  console.log("Nothing was signed or sent. The fee payer above was never asked for a signature.");
  if (bad) process.exit(1);
}
main().catch((e) => { console.error(e.message); process.exit(2); });
