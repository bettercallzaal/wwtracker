#!/usr/bin/env tsx
/**
 * How long after a battle opens on chain does the first trade land.
 *
 *   npx tsx scripts/ww-opening-gap.ts                 # the 40 most recent battles
 *   npx tsx scripts/ww-opening-gap.ts --battles 100
 *   npx tsx scripts/ww-opening-gap.ts --window 45     # the lag being tested against
 *   npx tsx scripts/ww-opening-gap.ts --out ~/zao-vault/projects/ww-opening-gap.md
 *
 * READ `lib/ww/openingGap.ts` BEFORE QUOTING THE OUTPUT. This is an upper bound
 * on how fast the earliest participant knew a battle had opened. It is NOT the
 * 45-second announcement lag, which still needs the marks from
 * `scripts/ww-mark.sh` and has never been recorded.
 *
 * One `getSignaturesForAddress` per battle, then the earliest few transactions
 * fetched and classified by instruction discriminator, so a launch instruction
 * is never counted as a trade.
 */
import { writeFileSync } from "node:fs";
import { battleDiscoveryRequest, parseBattleAccounts, type ProgramAccountRow } from "../lib/ww/discovery";
import { PROGRAM_ID, b58decode } from "../lib/ww/pda";
import { RELAYABLE } from "../lib/ww/relayPolicy";
import { DISCRIMINATOR_BY_NAME } from "../lib/ww/instructions";
import { buildOpeningGaps, describeOpeningGaps, type FirstTrade, type Opening } from "../lib/ww/openingGap";
import { optionValue } from "../lib/cliArgs";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const args = process.argv.slice(2);
const BATTLES = Number(optionValue(args, "--battles", "40"));
const WINDOW = Number(optionValue(args, "--window", "45"));
const OUT = optionValue(args, "--out", "");
/** How many of a battle's earliest transactions to inspect before giving up on finding a trade. */
const EARLIEST_TO_INSPECT = 10;

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

const BUY = RELAYABLE.buyShares;
const SELL = RELAYABLE.sellShares;
/**
 * The second launch instruction. Until it lands the battle's mints do not
 * exist, so no buy is possible: this, not `start_time`, is when the battle
 * became tradeable.
 */
const MINTS = Array.from(DISCRIMINATOR_BY_NAME.initializeMints, (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Classify a fetched transaction as a buy, a sell or neither.
 *
 * By DISCRIMINATOR, never by position in the signature list. The launch is two
 * instructions (`initializeBattle` then `initializeMints`), so "skip the first
 * two" is right until a battle is launched some other way, and then it silently
 * reports a launch as a trade.
 */
function classify(tx: any): "buy" | "sell" | "mints" | null {
  const msg = tx?.transaction?.message;
  if (!msg) return null;
  const keys: string[] = (msg.accountKeys ?? []).map((k: any) => (typeof k === "string" ? k : k.pubkey));
  for (const ix of msg.instructions ?? []) {
    const programId = ix.programId ?? keys[ix.programIdIndex];
    if (programId !== PROGRAM_ID) continue;
    // `jsonParsed` leaves an unknown program's instruction data BASE58-encoded,
    // not base64. Decoding it as base64 produces plausible bytes that match no
    // discriminator, so every trade would come back unclassified and the script
    // would report "no trades" for battles full of them - absence and failure
    // looking alike again.
    const data: string | undefined = ix.data;
    if (!data) continue;
    let disc: string;
    try {
      disc = Array.from(b58decode(data).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      continue;
    }
    if (disc === BUY) return "buy";
    if (disc === SELL) return "sell";
    if (disc === MINTS) return "mints";
  }
  return null;
}

async function openingOf(
  pubkey: string,
): Promise<{ trade: FirstTrade | null; mintsReadyTime: number | null; error?: string }> {
  let sigs: any[];
  try {
    sigs = (await rpc("getSignaturesForAddress", [pubkey, { limit: 1000 }])) ?? [];
  } catch (e) {
    return { trade: null, mintsReadyTime: null, error: `signatures: ${(e as Error).message}` };
  }
  // Newest first from the RPC. Oldest first is what "first trade" means.
  const ascending = sigs
    .filter((s) => s.blockTime != null && s.err == null)
    .sort((a, b) => a.blockTime - b.blockTime);
  if (ascending.length === 0) return { trade: null, mintsReadyTime: null };

  let mintsReadyTime: number | null = null;
  const window = ascending.slice(0, EARLIEST_TO_INSPECT);
  for (const s of window) {
    let parsed: any;
    try {
      parsed = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    } catch (e) {
      // NOT `continue`. Walking past an unfetchable transaction and taking the
      // next one that classifies reports a LATER trade as the first, and the
      // gap comes out too large with nothing saying so. An unreadable earliest
      // transaction makes the whole battle unreadable.
      return { trade: null, mintsReadyTime, error: `tx ${s.signature.slice(0, 12)}: ${(e as Error).message}` };
    }
    if (!parsed) return { trade: null, mintsReadyTime, error: `tx ${s.signature.slice(0, 12)}: empty result` };
    const kind = classify(parsed);
    if (kind === "mints") {
      mintsReadyTime = s.blockTime;
      continue;
    }
    if (kind === "buy" || kind === "sell") {
      return { trade: { signature: s.signature, blockTime: s.blockTime, kind }, mintsReadyTime };
    }
  }
  // Every transaction inspected was a non-trade AND there are more behind them:
  // that is "not found in the window", which is not the same fact as a battle
  // nobody traded.
  if (ascending.length > window.length) {
    return {
      trade: null,
      mintsReadyTime,
      error: `no trade in the earliest ${window.length} of ${ascending.length} transactions`,
    };
  }
  return { trade: null, mintsReadyTime };
}

async function main() {
  console.log(`opening gap, ${new Date().toISOString()}, via ${redactUrl(RPC)}`);
  const req = battleDiscoveryRequest();
  const rows = (await rpc(req.method, req.params)) as ProgramAccountRow[];
  const decode = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
  const all = parseBattleAccounts(rows, decode, Math.floor(Date.now() / 1000));
  console.log(`accounts read: ${rows.length}, decoded: ${all.length}`);
  if (all.length === 0) {
    console.log("NO BATTLES DECODED. Nothing below would be a measurement; stopping.");
    process.exit(1);
  }

  const newest = [...all].sort((a, b) => b.startTime - a.startTime).slice(0, BATTLES);
  console.log(`inspecting the ${newest.length} most recent battles, newest ${new Date(newest[0].startTime * 1000).toISOString()}\n`);

  const openings: Opening[] = [];
  const firstTrades = new Map<number, FirstTrade | null>();
  const unreadable = new Map<number, string>();
  let done = 0;
  for (const b of newest) {
    const { trade, mintsReadyTime, error } = await openingOf(b.pubkey);
    openings.push({ battleId: b.battleId, startTime: b.startTime, endTime: b.endTime, mintsReadyTime });
    if (error) unreadable.set(b.battleId, error);
    else firstTrades.set(b.battleId, trade);
    done++;
    if (done % 10 === 0) process.stderr.write(`  ${done}/${newest.length}\n`);
  }

  const report = buildOpeningGaps(openings, firstTrades, unreadable);
  const lines = describeOpeningGaps(report, WINDOW);
  for (const l of lines) console.log(l);

  if (OUT) {
    const body = [
      `# Chain open to first trade, ${openings.length} most recent battles`,
      "",
      `Measured ${new Date().toISOString()} via ${redactUrl(RPC)}.`,
      "",
      ...lines.map((l) => (l.startsWith("  ") ? l : `- ${l}`)),
      "",
      "## Per battle",
      "",
      "| battle | from start_time (s) | launch took (s) | from tradeable (s) | first trade |",
      "|---|---|---|---|---|",
      ...report.gaps
        .sort((a, b) => a.gapSeconds - b.gapSeconds)
        .map(
          (g) =>
            `| ${g.battleId} | ${g.gapSeconds} | ` +
            `${g.mintsReadyTime === null ? "UNKNOWN" : g.mintsReadyTime - g.startTime} | ` +
            `${g.gapFromTradeableSeconds === null ? "UNKNOWN" : g.gapFromTradeableSeconds} | ${g.firstTrade.kind} |`,
        ),
      "",
    ].join("\n");
    writeFileSync(OUT.replace(/^~/, process.env.HOME ?? "~"), body);
    console.log(`\nwrote ${OUT}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
