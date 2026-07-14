import type { BattleType, ScrapedBattle, StoredBattle } from "./types";

/** marginPct present -> QUICK (verified: every QUICK record in the current
 * 949-battle snapshot has a numeric margin, 0 exceptions). marginPct null
 * cannot be auto-split into MAIN vs COMMUNITY - the live feed has no type
 * field, and both existing MAIN and COMMUNITY records show margin: null. */
function classifyType(scraped: ScrapedBattle): BattleType {
  return scraped.marginPct === null ? "UNCLASSIFIED" : "QUICK";
}

/** Converts one scraped battle into the stored schema. Returns null (skip,
 * never invent) if a required field didn't parse. */
export function scrapedToStored(scraped: ScrapedBattle): StoredBattle | null {
  if (
    scraped.date === null ||
    scraped.winnerTitle === null ||
    scraped.song1Title === null ||
    scraped.song2Title === null ||
    scraped.totalVolumeSol === null
  ) {
    return null;
  }
  return {
    id: String(scraped.battleId),
    type: classifyType(scraped),
    date: scraped.date,
    a: scraped.song1Title,
    b: scraped.song2Title,
    aHandle: scraped.song1Handle,
    bHandle: scraped.song2Handle,
    winner: scraped.winnerTitle,
    vol: scraped.totalVolumeSol,
    margin: scraped.marginPct,
  };
}

export interface MergeResult {
  merged: StoredBattle[];
  added: StoredBattle[];
}

/** Merges freshly scraped battles into the existing stored list, deduping by
 * id. Existing records are never overwritten - only genuinely new battle_ids
 * get added. Result is sorted newest-first by id (battle ids increase
 * monotonically with time - verified). */
export function mergeBattles(existing: StoredBattle[], scraped: ScrapedBattle[]): MergeResult {
  const existingIds = new Set(existing.map((b) => b.id));
  const added: StoredBattle[] = [];
  for (const s of scraped) {
    const stored = scrapedToStored(s);
    if (!stored) continue;
    if (existingIds.has(stored.id)) continue;
    existingIds.add(stored.id);
    added.push(stored);
  }
  const merged = [...existing, ...added].sort((x, y) => Number(y.id) - Number(x.id));
  return { merged, added };
}
