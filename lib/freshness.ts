// Single place to stamp data freshness. Bump when snapshots are regenerated
// (see docs/REFRESH.md). Shown in the app footer so the team knows how current
// the baked data is. The treasury balance and Audius/YouTube are always live.
export const DATA_AS_OF = "2026-06-15";

// Per-dataset detail (optional, for transparency).
export const FRESHNESS: Record<string, string> = {
  "songs / leaderboards / battles / traders": "2026-06-15",
  "skips / queue (Dune)": "2026-06-16",
  "daily activity + volume board (Dune, 30d)": "2026-06-16",
  "on-chain analytics (Dune snapshot)": "2026-06-14",
  "treasury balance / Audius / YouTube": "live",
};
