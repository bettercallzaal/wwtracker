// Single place to stamp data freshness. Shown in the app footer so the team
// knows how current the baked data is.
//
// This is the OLDEST still-baked dataset, not the newest. Refreshing one source
// does not move it - the footer must not claim a currency the slowest snapshot
// does not have.
//
// It moved from 2026-06-14 to 2026-08-25 because most of what used to be baked
// is not baked any more: the leaderboards, songs, artists and platform totals
// are read live from wavewarz.info's public API, the treasury series is
// re-executed on Dune by a daily cron, and the on-chain and volume series were
// regenerated from the program's real first day. What is left baked is the
// battle history file used by the recap tooling, and the manual ops ledger.
export const DATA_AS_OF = "2026-08-25";

// Per-dataset detail. "live" means it is fetched at request time and has no age
// of its own beyond its upstream's cache window.
export const FRESHNESS: Record<string, string> = {
  "treasury balance + intraday high (Dune, daily cron)": "live",
  "platform totals, leaderboards, songs, artists (wavewarz.info API)": "live",
  "Audius plays / YouTube": "live",
  "on-chain daily activity + instruction mix (Dune, from 2025-05-26)": "2026-09-05",
  "platform volume timeline (per-battle, from 2025-05-28)": "2026-09-05",
  "program + treasury snapshot (lib/wwData.ts)": "2026-09-05",
  "SOL/USD reference price": "2026-09-05",
  "battle history file (recap tooling, npm run fetch:battles)": "2026-08-25",
  "artist roster for static routes (lib/leaderboard.ts)": "2026-06-15",
  "ops ledger + distributions (team-reported, manual)": "manual",
};
