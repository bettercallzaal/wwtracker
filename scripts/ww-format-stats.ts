#!/usr/bin/env tsx
/**
 * What each battle format is, over every labelled battle rather than 200.
 *
 *   npx tsx scripts/ww-format-stats.ts
 *
 * `brand/FORMATS.md` was built from the 200 most recent battles the public API
 * returns, and said so: "the per-format numbers below describe current
 * practice, not all time." `public/ww-battles.json` now holds the whole
 * history, so the same table can be built over all of it.
 *
 * Joins the labelled file to a chain scan on the battle id. A battle in one
 * and not the other is reported, never dropped quietly.
 */
import { readFileSync } from "node:fs";
import { battleDiscoveryRequest, parseBattleAccounts, type ProgramAccountRow } from "../lib/ww/discovery";
import { buildFormatReport, durationHistogram, type LabelledBattle } from "../lib/ww/formatStats";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOL = (l: number) => (l / 1e9).toFixed(3);
const mins = (s: number) => `${Math.round(s / 60)} min`;

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const raw = JSON.parse(readFileSync("public/ww-battles.json", "utf8")) as Array<{
    id: string | number;
    type?: string;
    date?: string;
  }>;
  const labelled: LabelledBattle[] = raw
    .filter((r) => r.type)
    .map((r) => ({ id: Number(r.id), type: String(r.type).toLowerCase() }));
  console.log(`labelled battles: ${labelled.length} of ${raw.length} rows in public/ww-battles.json`);

  const req = battleDiscoveryRequest();
  const rows = (await rpc(req.method, req.params)) as ProgramAccountRow[];
  const chain = parseBattleAccounts(rows, (s) => new Uint8Array(Buffer.from(s, "base64")));
  console.log(`chain accounts: ${chain.length}, via ${redactUrl(RPC)}\n`);

  const report = buildFormatReport(labelled, chain);
  console.log(
    `joined ${report.matched} of ${labelled.length} labelled battles; ` +
      `${report.unmatched} had no account on chain, ${report.unlabelled} accounts carry no label.`,
  );
  if (report.matched === 0) {
    console.log("NOTHING JOINED - every number below would be empty, so there are none.");
    process.exit(1);
  }

  console.log("");
  console.log("| format | battles | traded | median duration | range | median pool | largest pool |");
  console.log("|---|---|---|---|---|---|---|");
  for (const s of report.stats) {
    console.log(
      `| ${s.type} | ${s.battles} | ${s.traded} of ${s.battles} | ` +
        `${s.medianDurationSeconds === null ? "UNKNOWN" : mins(s.medianDurationSeconds)} | ` +
        `${s.minDurationSeconds === null ? "UNKNOWN" : `${s.minDurationSeconds}s to ${s.maxDurationSeconds}s`} | ` +
        `${s.medianPoolLamports === null ? "none traded" : `${SOL(s.medianPoolLamports)} SOL`} | ` +
        `${s.maxPoolLamports === null ? "none traded" : `${SOL(s.maxPoolLamports)} SOL`} |`,
    );
  }

  console.log("\ncommonest durations across every battle on chain:");
  for (const h of durationHistogram(chain)) {
    console.log(`  ${String(h.seconds).padStart(6)}s (${mins(h.seconds).padStart(7)})  ${h.battles} battles`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
