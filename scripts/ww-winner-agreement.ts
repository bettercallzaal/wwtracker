#!/usr/bin/env tsx
/**
 * Does the announced winner match the one the program pays, per format.
 *
 *   npx tsx scripts/ww-winner-agreement.ts
 *
 * A battle has two winners. The settlement winner is the larger pool, written
 * by the program, and it is what a claim pays out on. The judged winner is
 * decided off chain - 2-of-3 for quick battles, a panel for main events - and
 * it is what the room is told. They disagree on about one in eight overall;
 * this asks whether the rate is the same for each judging procedure.
 *
 * NOT A FAIRNESS VERDICT. A judged result that differs from the pool is the
 * intended behaviour of a judged competition. What the rate can support is a
 * comparison between procedures, where the samples carry one.
 */
import { readFileSync } from "node:fs";
import { battleDiscoveryRequest, parseBattleAccounts, type ProgramAccountRow } from "../lib/ww/discovery";
import { agreementByFormat, chanceOfAtLeast, disagreementRate, type JudgedBattle, type SettledBattle } from "../lib/ww/winnerAgreement";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const raw = JSON.parse(readFileSync("public/ww-battles.json", "utf8")) as Array<{
    id: string | number; type?: string; a?: string; b?: string; winner?: string | null;
  }>;
  const judged: JudgedBattle[] = raw
    .filter((r) => r.type && r.winner && r.a && r.b)
    .map((r) => ({
      battleId: Number(r.id),
      type: String(r.type).toLowerCase(),
      judgedWinner: String(r.winner),
      sideA: String(r.a),
      sideB: String(r.b),
    }));
  console.log(`battles with a judged winner: ${judged.length} of ${raw.length}`);

  const req = battleDiscoveryRequest();
  const rows = (await rpc(req.method, req.params)) as ProgramAccountRow[];
  const chain = parseBattleAccounts(rows, (s) => new Uint8Array(Buffer.from(s, "base64")));
  const byId = new Map<number, SettledBattle>(
    chain.map((c) => [c.battleId, { battleId: c.battleId, settlementWinner: c.settlementWinner, poolLamports: c.poolLamports }]),
  );
  console.log(`chain accounts: ${chain.length}, via ${redactUrl(RPC)}\n`);

  const formats = agreementByFormat(judged, byId);
  const total = formats.reduce(
    (t, f) => ({ agree: t.agree + f.agree, disagree: t.disagree + f.disagree, comparable: t.comparable + f.comparable }),
    { agree: 0, disagree: 0, comparable: 0 },
  );

  // The largest format is the baseline every other rate is read against: it
  // has the judging procedure most battles use and much the biggest sample.
  const baseline = formats[0];
  const baselineRate = disagreementRate(baseline);

  console.log("| format | comparable | agree | disagree | rate | vs the baseline | ties | unsettled | unresolvable |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const f of formats) {
    const r = disagreementRate(f);
    let versus = "the baseline";
    if (f !== baseline) {
      const p = baselineRate === null ? null : chanceOfAtLeast(f.disagree, f.comparable, baselineRate);
      versus =
        p === null
          ? "UNKNOWN"
          : `chance alone gives this or more ${p < 0.01 ? "<1" : (p * 100).toFixed(0)}% of the time`;
    }
    console.log(
      `| ${f.type} | ${f.comparable} | ${f.agree} | ${f.disagree} | ` +
        `${r === null ? "UNKNOWN (nothing comparable)" : `${(r * 100).toFixed(1)}%`} | ${versus} | ` +
        `${f.tie} | ${f.unsettled} | ${f.unresolvable} |`,
    );
  }
  console.log(
    `\nall formats: ${total.disagree} of ${total.comparable} disagree` +
      (total.comparable ? ` (${((total.disagree / total.comparable) * 100).toFixed(1)}%)` : " - NOTHING COMPARABLE"),
  );
  console.log("A judged result differing from the pool is the intended behaviour of a judged");
  console.log("competition. This compares procedures; it does not score anyone.");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
