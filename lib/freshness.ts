// Single place to stamp data freshness. Bump when snapshots are regenerated
// (see docs/REFRESH.md). Shown in the app footer so the team knows how current
// the baked data is. The treasury balance and Audius/YouTube are always live.
export const DATA_AS_OF = "2026-07-16";

// Per-dataset detail (optional, for transparency).
export const FRESHNESS: Record<string, string> = {
  "battle stats (wavewarz.info public API)": "2026-07-16",
  "songs / leaderboards / battles / traders": "2026-07-16",
  "platform volume (Dune, from launch 2025-05-26)": "2026-06-16",
  "skips / queue (Dune, all-time)": "2026-06-16",
  "queue vs DJ Wavy split (Dune)": "2026-06-16",
  "daily activity + volume board (Dune, 30d)": "2026-06-16",
  "on-chain analytics (Dune snapshot)": "2026-06-14",
  "treasury balance / Audius / YouTube": "live",
};
