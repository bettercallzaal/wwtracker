/**
 * PRD 34 scored against a real indexer: wavewarz.info's public API.
 *
 * The observation below is built by looking at what the API actually returns,
 * not at what its docs claim. Re-run it and the numbers move with the API.
 *
 *   npx tsx scripts/ww-indexer-report.ts
 */
import { assessIndexerCoverage, formatCoverage, type Observation } from "@/lib/ww";

const BASE = "https://wavewarz.info/api/public";
const get = async (p: string) => (await fetch(`${BASE}${p}`)).json();

async function main() {
  const stats = await get("/stats");
  const battles = await get("/battles?limit=200&offset=0");
  const events = await get("/events?limit=200&offset=0");
  const row = battles.battles?.[0] ?? {};
  const rounds = (events.events ?? []).flatMap((e: Record<string, unknown>) => (e.rounds as unknown[]) ?? []);
  const r0 = (rounds[0] ?? {}) as Record<string, unknown>;
  const has = (o: Record<string, unknown>, k: string) => o[k] !== undefined;

  // What the API demonstrably serves, field by field.
  const observed: Observation = {
    battle_creation: has(row, "createdAt") ? "covered" : "absent",
    mint_initialization: "absent",            // no mint address anywhere in the public API
    buys: "absent",                           // no per-trade data is exposed
    sells: "absent",
    pool_changes: has(r0, "artist1PoolSol") ? "partial" : "absent", // final pool per round only
    token_supply: "absent",
    fees: stats?.artistPayouts?.totalSol !== undefined ? "partial" : "absent", // a total, not per trade
    artist_payouts: stats?.artistPayouts?.totalSol !== undefined ? "covered" : "absent",
    battle_end: has(row, "endsAt") ? "covered" : "absent",
    winner: has(row, "winnerSide") ? "covered" : "absent",
    claims: stats?.traderClaims?.withdrawalCount !== undefined ? "partial" : "absent",
    settlement: has(row, "winnerDecided") ? "partial" : "absent",
    operator_attribution: "absent",
    currencies_used: "absent",                // implied SOL everywhere, never stated
    swap_activity: "absent",
    final_records: has(row, "battleId") ? "covered" : "absent",
    reindex_from_history: "absent",           // not something an API can demonstrate
  };

  const rep = assessIndexerCoverage(observed);
  console.log("PRD 34 against wavewarz.info's public API\n");
  for (const line of formatCoverage(rep)) console.log("  " + line);
  console.log(
    `\n  covered ${rep.covered}   partial ${rep.partial}   absent ${rep.absent}   of ${rep.rows.length}`,
  );
  console.log(`  of what it serves, ${rep.chainCheckable} are chain facts it restates`);
  console.log(`  and ${rep.indexerOnly} are things only it can know`);
  if (rep.authorityWarnings.length) {
    console.log("\n  AUTHORITY:");
    for (const w of rep.authorityWarnings) console.log("    " + w);
  }
}
main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
