// Building public/ww-battles.json from WaveWarZ's own public API.
//
// WHY THIS REPLACED THE HTML SCRAPE. The file was built by parsing the React
// flight payload out of wavewarz-intelligence's /battles pages. Measured
// 2026-09-09, that route had three problems and the file had all of them:
//
//  1. It stopped early. `fetchNewBattles` walks pages until one adds nothing
//     new, which assumes every battle we are missing is newer than every
//     battle we have. It is not: the 213 absent battles were spread across
//     EVERY month since launch, 4 here and 17 there, not one block at the
//     front. A gap behind the frontier was unreachable forever.
//  2. The feed serves 209 of its 1,485 battles with no titles and no winner,
//     and a date with no year ("Aug 29"). Those rows cannot be stored without
//     inventing fields, so they were correctly dropped - and silently.
//  3. Its volume figures predate the record layer's backfill. The stored file
//     summed to 412.38 SOL against the platform's own 923.10. Not stale by a
//     few days: less than half.
//
// The public API answers all three. /battles?limit=200&offset=N pages the
// complete set, carries a real `type` (so nothing is UNCLASSIFIED), a real
// timestamp, per-artist pool and volume, and its volume total agrees with
// /stats to the lamport.
//
// WHAT IT DOES NOT ANSWER, and why this merges rather than replaces: the API
// returns `winnerSide: null` on 239 battles, 216 of which we already hold a
// winner for from the scrape. Pool size does not recover it - battle
// 1787370496 has both pools at exactly 0.0493 - so the old value is the only
// evidence that exists. An API field being null is not evidence that our
// value is wrong, so a null never overwrites a value we already have.
import type { BattleSummary } from "../../lib/wavewarzApi";
import type { StoredBattle } from "./types";

/**
 * The artist's Audius handle, from their track link.
 *
 * `artist1.name` is the TRACK TITLE (see lib/artistIdentity.ts); the handle is
 * the only artist identity in a battle summary. The scrape left this null on
 * 883 of the 1,288 battles it shared with the API.
 */
export function handleFromMusicLink(link: string | null | undefined): string | null {
  if (!link) return null;
  const m = /^https?:\/\/audius\.co\/([^/?#]+)/i.exec(link.trim());
  return m ? m[1] : null;
}

/** "2026-08-25T03:48:27Z" -> "Aug 25, 2026", the display format already stored. */
export function displayDate(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Winning margin as a percentage of the combined pool.
 *
 * Checked against the scraped value on battle 1787629692: pools 0.0788 and
 * 0.1773 give 38.5%, and the feed said 38. Returns null on a zero pool rather
 * than dividing by it - a battle nobody traded has no margin, and 0 would read
 * as a dead heat.
 */
export function marginPct(poolA: number, poolB: number): number | null {
  const total = poolA + poolB;
  if (total <= 0) return null;
  return Math.round((Math.abs(poolA - poolB) / total) * 100);
}

export function publicBattleToStored(b: BattleSummary): StoredBattle {
  const a1 = b.artist1;
  const a2 = b.artist2;
  const winner =
    b.winnerSide === "artist1" ? a1.name : b.winnerSide === "artist2" ? a2.name : null;
  return {
    id: String(b.battleId),
    type: b.type.toUpperCase() as StoredBattle["type"],
    date: displayDate(b.createdAt),
    a: a1.name,
    b: a2.name,
    aHandle: handleFromMusicLink(a1.musicLink),
    bHandle: handleFromMusicLink(a2.musicLink),
    winner,
    vol: Math.round(((a1.volumeSol ?? 0) + (a2.volumeSol ?? 0)) * 10000) / 10000,
    margin: marginPct(a1.poolSol ?? 0, a2.poolSol ?? 0),
  };
}

export interface ApiMergeResult {
  merged: StoredBattle[];
  added: StoredBattle[];
  /** Battles we hold that the API does not list. Kept, never dropped. */
  keptOutsideApi: StoredBattle[];
  /** Fields where the API returned null and the stored value survived. */
  preserved: { id: string; field: string }[];
}

/**
 * The API is authoritative for every field it actually fills in.
 *
 * The one asymmetry: a null from the API never overwrites a value we already
 * have. That is what stops a refresh deleting 216 winners the API has no side
 * for, and it is why this is a merge. It cuts the other way too - once the API
 * starts returning those winners, they land, because a non-null always wins.
 */
export function mergeFromApi(
  existing: StoredBattle[],
  fromApi: StoredBattle[],
): ApiMergeResult {
  const byId = new Map(existing.map((b) => [b.id, b]));
  const apiIds = new Set(fromApi.map((b) => b.id));
  const added: StoredBattle[] = [];
  const preserved: { id: string; field: string }[] = [];
  const out: StoredBattle[] = [];

  for (const fresh of fromApi) {
    const old = byId.get(fresh.id);
    if (!old) {
      added.push(fresh);
      out.push(fresh);
      continue;
    }
    const row = { ...fresh };
    for (const key of ["aHandle", "bHandle", "winner", "margin"] as const) {
      if (row[key] === null && old[key] !== null && old[key] !== undefined) {
        (row as Record<string, unknown>)[key] = old[key];
        preserved.push({ id: fresh.id, field: key });
      }
    }
    out.push(row);
  }

  // Two MAIN events predate the API listing and were written before aHandle /
  // bHandle existed, so those keys are absent rather than null. Normalise them
  // - a consumer reading b.aHandle on a row that has no such key gets
  // undefined, which is a third state nothing in this repo handles.
  const keptOutsideApi = existing
    .filter((b) => !apiIds.has(b.id))
    .map((b) => ({
      ...b,
      aHandle: b.aHandle ?? null,
      bHandle: b.bHandle ?? null,
      margin: b.margin ?? null,
    }));
  const merged = [...out, ...keptOutsideApi].sort((x, y) => Number(y.id) - Number(x.id));
  return { merged, added, keptOutsideApi, preserved };
}
