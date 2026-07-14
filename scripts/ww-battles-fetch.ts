// Fetches new WaveWarZ battles from the public Battle Intelligence feed and
// merges them into public/ww-battles.json. Fails loud on any HTTP or parse
// error - never falls back to writing stale/partial data silently.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseWaveWarzBattlesPage } from "./recap/battle-parser";
import { mergeBattles } from "./recap/merge-battles";
import type { StoredBattle } from "./recap/types";

const INTELLIGENCE_BASE = "https://wavewarz-intelligence.vercel.app";
const BATTLES_JSON_PATH = fileURLToPath(new URL("../public/ww-battles.json", import.meta.url));

export type FetchPage = (page: number) => Promise<string>;

export function httpFetchPage(fetchImpl: typeof fetch = fetch): FetchPage {
  return async (page: number) => {
    const url = page <= 1 ? `${INTELLIGENCE_BASE}/battles` : `${INTELLIGENCE_BASE}/battles?page=${page}`;
    const res = await fetchImpl(url, { headers: { "User-Agent": "wwtracker-recap/1.0" } });
    if (!res.ok) {
      throw new Error(`/battles page ${page} returned HTTP ${res.status}`);
    }
    return res.text();
  };
}

export interface FetchResult {
  added: StoredBattle[];
  merged: StoredBattle[];
  pagesFetched: number;
}

/** Paginates the /battles feed (newest-first) until a page yields no new
 * battles (the fetch frontier) or maxPages is hit. Throws if any page parses
 * to zero battles - that means the feed's shape changed, not that history
 * ended (history ending looks like "all already known", not "empty"). */
export async function fetchNewBattles(
  existing: StoredBattle[],
  fetchPage: FetchPage,
  maxPages = 10,
): Promise<FetchResult> {
  let merged = existing;
  let allAdded: StoredBattle[] = [];
  let page = 1;
  for (; page <= maxPages; page += 1) {
    const html = await fetchPage(page);
    const scraped = parseWaveWarzBattlesPage(html);
    if (scraped.length === 0) {
      throw new Error(`/battles page ${page} parsed zero battles - feed shape may have changed`);
    }
    const result = mergeBattles(merged, scraped);
    merged = result.merged;
    allAdded = [...allAdded, ...result.added];
    if (result.added.length === 0) {
      return { added: allAdded, merged, pagesFetched: page };
    }
  }
  return { added: allAdded, merged, pagesFetched: maxPages };
}

async function main() {
  const existing: StoredBattle[] = JSON.parse(readFileSync(BATTLES_JSON_PATH, "utf-8"));
  const { added, merged, pagesFetched } = await fetchNewBattles(existing, httpFetchPage());
  if (added.length === 0) {
    console.log(`No new battles found (checked ${pagesFetched} page(s)).`);
    return;
  }
  writeFileSync(BATTLES_JSON_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Added ${added.length} new battle(s) (checked ${pagesFetched} page(s)):`);
  for (const b of added) {
    console.log(`  ${b.id}  ${b.date}  ${b.type}  ${b.a} vs ${b.b}  winner=${b.winner}  vol=${b.vol}`);
  }
  const unclassified = added.filter((b) => b.type === "UNCLASSIFIED");
  if (unclassified.length > 0) {
    console.log(`\n${unclassified.length} battle(s) need manual classification (MAIN vs COMMUNITY):`);
    for (const b of unclassified) console.log(`  ${b.id}  ${b.date}  ${b.a} vs ${b.b}`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`ww-battles-fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
