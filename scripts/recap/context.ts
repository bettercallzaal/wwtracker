export interface LeaderboardEntry {
  name: string;
  handle: string;
  rank: number;
  rec: string;
  win: number;
}

export interface LeaderboardContext {
  rank: number;
  record: string;
  winPct: number;
}

/** Looks up an artist's Main Event leaderboard standing. Tries the handle
 * first (reliable when the scraper captured one), falls back to matching the
 * display name (needed for older battles that predate handle capture). */
export function findLeaderboardEntry(
  board: LeaderboardEntry[],
  handle: string | null,
  displayName: string,
): LeaderboardContext | null {
  const byHandle = handle
    ? board.find((e) => e.handle.toLowerCase() === handle.toLowerCase())
    : undefined;
  const entry = byHandle ?? board.find((e) => e.name.toLowerCase() === displayName.toLowerCase());
  if (!entry) return null;
  return { rank: entry.rank, record: entry.rec, winPct: entry.win };
}

export interface DayActivityEntry {
  date: string; // ISO YYYY-MM-DD
  buys: number;
  sells: number;
  battles: number;
  settled: number;
  claims: number;
}

export function findDayActivity(activities: DayActivityEntry[], isoDate: string): DayActivityEntry | null {
  return activities.find((a) => a.date === isoDate) ?? null;
}
