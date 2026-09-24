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
import { describeFirstBuyers, firstBuyerConcentration, shortAddress, type FirstBuyerRow } from "../lib/ww/firstBuyer";
import { describeFirstSide, firstSideReport, type FirstSideRow } from "../lib/ww/firstSide";
import { optionValue } from "../lib/cliArgs";
import { redactUrl } from "../lib/redact";
import { TREASURY_WALLET } from "../lib/config";

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
/**
 * The side and size of a buy, from the instruction's own bytes.
 *
 * Layout from `instructions.ts`: 8-byte discriminator, `amountLamports` as a
 * little-endian u64, then one byte that is 1 for artist A. Decoded rather than
 * inferred from pool deltas, because two trades inside one poll interval do
 * not sum (see `tradeObservation.ts`) and an inference would be wrong exactly
 * when a battle is busiest.
 */
function buyDetail(data: Uint8Array): { side: "a" | "b"; amountLamports: number } | null {
  if (data.length < 17) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const amount = view.getBigUint64(8, true);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return { side: data[16] === 1 ? "a" : "b", amountLamports: Number(amount) };
}

type Classified = { kind: "buy"; side: "a" | "b"; amountLamports: number } | { kind: "sell" | "mints" };

function classify(tx: any): Classified | null {
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
    let bytes: Uint8Array;
    try {
      bytes = b58decode(data);
    } catch {
      continue;
    }
    const disc = Array.from(bytes.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
    if (disc === BUY) {
      const detail = buyDetail(bytes);
      // A buy whose own bytes will not decode is not a sell and not an
      // absence: report it as a buy with no side rather than silently moving
      // on to the next transaction and calling a later trade the first.
      return detail ? { kind: "buy", ...detail } : { kind: "sell" };
    }
    if (disc === SELL) return { kind: "sell" };
    if (disc === MINTS) return { kind: "mints" };
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
    const c = classify(parsed);
    const kind = c?.kind;
    if (kind === "mints") {
      mintsReadyTime = s.blockTime;
      continue;
    }
    if (kind === "buy" || kind === "sell") {
      // accounts[0] is the fee payer and must have signed, so on a trade it is
      // the trader. Read from the parsed message rather than assumed.
      const keys: any[] = parsed?.transaction?.message?.accountKeys ?? [];
      const first = keys[0];
      const trader = typeof first === "string" ? first : first?.pubkey;
      const side = c && c.kind === "buy" ? c.side : undefined;
      const amountLamports = c && c.kind === "buy" ? c.amountLamports : undefined;
      return {
        trade: { signature: s.signature, blockTime: s.blockTime, kind, trader, side, amountLamports },
        mintsReadyTime,
      };
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

  // WHO got there first, which is the question the timing alone cannot answer:
  // a tight floor is either a room reacting together or one wallet on a timer.
  const buyerRows: FirstBuyerRow[] = report.gaps
    .filter((g) => typeof g.firstTrade.trader === "string")
    .map((g) => ({
      battleId: g.battleId,
      trader: g.firstTrade.trader as string,
      gapFromTradeableSeconds: g.gapFromTradeableSeconds,
    }));
  // The treasury is the platform's, and lib/config.ts has said since 2026-09-06
  // that anything treating it as a pure trader is wrong. It creates battles as
  // well as trading them.
  const concentration = firstBuyerConcentration(buyerRows, new Set([TREASURY_WALLET]));

  // Did going first land on the larger final pool. Only buys carry a side, and
  // only battles whose pools we read can be scored.
  const pools = new Map(newest.map((b) => [b.battleId, b.poolLamports]));
  const sideRows: FirstSideRow[] = report.gaps
    .filter((g) => g.firstTrade.kind === "buy" && g.firstTrade.side && g.firstTrade.amountLamports !== undefined)
    .flatMap((g) => {
      const p = pools.get(g.battleId);
      if (!p) return [];
      return [{
        battleId: g.battleId,
        side: g.firstTrade.side as "a" | "b",
        amountLamports: g.firstTrade.amountLamports as number,
        poolALamports: p.a,
        poolBLamports: p.b,
      }];
    });
  const sideReport = firstSideReport(sideRows);
  const sideLines = describeFirstSide(sideReport);
  const buyerLines = describeFirstBuyers(concentration);
  console.log("");
  if (buyerRows.length < report.gaps.length) {
    console.log(
      `first buyer unreadable on ${report.gaps.length - buyerRows.length} of ${report.gaps.length} gaps, excluded from the counts below`,
    );
  }
  for (const l of buyerLines) console.log(l);
  console.log("");
  if (sideRows.length < report.gaps.length) {
    console.log(
      `opening side unreadable on ${report.gaps.length - sideRows.length} of ${report.gaps.length} gaps (sells carry no side), excluded below`,
    );
  }
  for (const l of sideLines) console.log(l);

  if (OUT) {
    const body = [
      `# Chain open to first trade, ${openings.length} most recent battles`,
      "",
      `Measured ${new Date().toISOString()} via ${redactUrl(RPC)}.`,
      "",
      ...lines.map((l) => (l.startsWith("  ") ? l : `- ${l}`)),
      "",
      "## Who was first",
      "",
      ...buyerLines.map((l) => (l.startsWith("  ") ? l : `- ${l}`)),
      "",
      "## Does going first pick the winner",
      "",
      ...sideLines.map((l) => (l.startsWith("  ") ? l : `- ${l}`)),
      "",
      "## Per battle",
      "",
      "| battle | from start_time (s) | launch took (s) | from tradeable (s) | first trade | first buyer |",
      "|---|---|---|---|---|---|",
      ...report.gaps
        .sort((a, b) => a.gapSeconds - b.gapSeconds)
        .map(
          (g) =>
            `| ${g.battleId} | ${g.gapSeconds} | ` +
            `${g.mintsReadyTime === null ? "UNKNOWN" : g.mintsReadyTime - g.startTime} | ` +
            `${g.gapFromTradeableSeconds === null ? "UNKNOWN" : g.gapFromTradeableSeconds} | ${g.firstTrade.kind} | ` +
            `${g.firstTrade.trader ? shortAddress(g.firstTrade.trader) : "UNKNOWN"} |`,
        ),
      "",
    ].join("\n");
    writeFileSync(OUT.replace(/^~/, process.env.HOME ?? "~"), body);
    console.log(`\nwrote ${OUT}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
