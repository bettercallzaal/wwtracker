// Rebuilds public/ww-battles.json from WaveWarZ's own public API.
//
// This used to scrape the React flight payload out of wavewarz-intelligence's
// /battles pages and walk them until a page added nothing new. That frontier
// rule assumes everything missing is newer than everything held, and on
// 2026-09-09 that was measurably false: 213 battles were absent, spread across
// every month since launch, so no number of runs would ever have found them.
// scripts/recap/battles-from-api.ts carries the full reasoning.
//
// Fails loud on any HTTP or parse error - it never writes stale or partial
// data silently. A short page ends the walk; a failed page ends the run.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getPublicBattles, type BattleSummary } from "../lib/wavewarzApi";
import { mergeFromApi, publicBattleToStored } from "./recap/battles-from-api";
import { parseWaveWarzBattlesPage } from "./recap/battle-parser";
import type { StoredBattle } from "./recap/types";

const BATTLES_JSON_PATH = fileURLToPath(new URL("../public/ww-battles.json", import.meta.url));

/** The API caps a page at 200 however much you ask for - measured, not documented. */
const PAGE = 200;

export type FetchPage = (limit: number, offset: number) => Promise<BattleSummary[]>;

export function httpFetchPage(): FetchPage {
  return async (limit, offset) => (await getPublicBattles({ limit, offset })).battles;
}

/**
 * Every battle the API will hand over, walked by offset.
 *
 * There is no frontier check here on purpose. The walk is eight requests for
 * the whole platform, and stopping early is exactly the bug this replaced.
 */
export async function fetchAllBattles(
  fetchPage: FetchPage,
  maxPages = 40,
): Promise<{ battles: StoredBattle[]; pagesFetched: number }> {
  const seen = new Map<string, StoredBattle>();
  let page = 0;
  for (; page < maxPages; page += 1) {
    const rows = await fetchPage(PAGE, page * PAGE);
    if (page === 0 && rows.length === 0) {
      throw new Error("/battles returned zero battles on the first page - API shape may have changed");
    }
    for (const r of rows) {
      const stored = publicBattleToStored(r);
      if (!seen.has(stored.id)) seen.set(stored.id, stored);
    }
    if (rows.length < PAGE) return { battles: [...seen.values()], pagesFetched: page + 1 };
  }
  return { battles: [...seen.values()], pagesFetched: page };
}

const INTELLIGENCE_BASE = "https://wavewarz-intelligence.vercel.app";

/**
 * Winners the platform API does not have, read off the intelligence app.
 *
 * The two sources genuinely disagree. Measured 2026-09-09: the API returns no
 * `winnerSide` for 239 battles, and the intelligence page shows a winner for
 * 214 of them - 184 of those the API calls undecided outright. One of them is
 * ahead of the other and this run does not adjudicate which, so this only ever
 * FILLS A NULL. It cannot change a winner the API stated.
 *
 * Off by default: it is 70-odd page requests against 8 for the API walk. Run
 * it when the null count matters - `npm run fetch:battles -- --fill-winners`.
 */
async function winnersFromIntelligence(maxPages = 90): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  let quiet = 0;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = page <= 1 ? `${INTELLIGENCE_BASE}/battles` : `${INTELLIGENCE_BASE}/battles?page=${page}`;
    const res = await fetch(url, { headers: { "User-Agent": "wwtracker-recap/1.0" } });
    if (!res.ok) throw new Error(`/battles page ${page} returned HTTP ${res.status}`);
    const rows = parseWaveWarzBattlesPage(await res.text());
    let fresh = 0;
    for (const r of rows) {
      const id = String(r.battleId);
      if (r.winnerTitle && !found.has(id)) { found.set(id, r.winnerTitle); fresh += 1; }
    }
    // The feed repeats its last page forever rather than 404ing, so the end is
    // "several pages that told us nothing", not an error status.
    quiet = fresh === 0 ? quiet + 1 : 0;
    if (quiet >= 4) break;
  }
  return found;
}

async function main() {
  const fillWinners = process.argv.includes("--fill-winners");
  const existing: StoredBattle[] = JSON.parse(readFileSync(BATTLES_JSON_PATH, "utf-8"));
  const { battles, pagesFetched } = await fetchAllBattles(httpFetchPage());
  const { merged, added, keptOutsideApi, preserved } = mergeFromApi(existing, battles);

  let filled = 0;
  if (fillWinners) {
    const winners = await winnersFromIntelligence();
    for (const b of merged) {
      if (b.winner === null) {
        const w = winners.get(b.id);
        if (w) { b.winner = w; filled += 1; }
      }
    }
    console.log(`--fill-winners: ${winners.size} winners read from the intelligence app, ${filled} null(s) filled.`);
  }

  writeFileSync(BATTLES_JSON_PATH, JSON.stringify(merged, null, 2) + "\n");

  const vol = merged.reduce((s, b) => s + b.vol, 0);
  const noWinner = merged.filter((b) => b.winner === null).length;
  console.log(
    `${merged.length} battles written from ${pagesFetched} page(s) - ` +
      `${added.length} new, ${keptOutsideApi.length} held outside the API, ` +
      `${preserved.length} field(s) preserved against a null.`,
  );
  console.log(`Volume across the file: ${vol.toFixed(2)} SOL. Battles with no winner yet: ${noWinner}.`);
  for (const b of added.slice(0, 15)) {
    console.log(`  + ${b.id}  ${b.date}  ${b.type}  ${b.a} vs ${b.b}  winner=${b.winner ?? "-"}  vol=${b.vol}`);
  }
  if (added.length > 15) console.log(`  ... and ${added.length - 15} more`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`ww-battles-fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
