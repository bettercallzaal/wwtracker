// Single place to stamp data freshness. Shown in the app footer so the team
// knows how current the baked data is.
//
// This is the OLDEST still-baked dataset, not the newest. Refreshing one source
// does not move it - the footer must not claim a currency the slowest snapshot
// does not have.
//
// Every date below is MEASURED from its source, and lib/__tests__/freshness.test.ts
// fails if one stops matching. Until 2026-09-11 they were typed by hand and had
// drifted three ways at once: DATA_AS_OF said 2026-08-25 while the datasets the
// homepage bakes all ran to 2026-09-05; the banner called the battle-history
// file "16 days old" when it was three; and the SOL/USD row said 2026-09-05
// against lib/price.ts's 2026-09-08. Same shape as every other drift on this
// site - a stamp nobody re-derived when the thing it describes moved.
//
// WHY THESE ARE LITERALS AND NOT DERIVED. This module is imported by client
// components (FreshnessBanner, AppShell). Deriving the dates here means
// importing the data files, and those ship to every visitor: about 110 KB for
// the three series behind DATA_AS_OF, 520 KB with the battle file behind
// BATTLES_AS_OF - against a 261 KB first load. Measured 2026-09-11. So they
// stay literals, and freshness.test.ts derives each one from its source in CI
// and fails the moment a literal and its source disagree. The drift was
// thought about; the maintenance is "update the literal the test names".
export const DATA_AS_OF = "2026-09-05";

/** The battle-history file's own date - what /api/battles/stats is computed from. */
export const BATTLES_AS_OF = "2026-09-08";

/** Which baked dataset DATA_AS_OF is the date of - the banner names it. */
export const OLDEST_BAKED = "on-chain daily activity, volume timeline and program snapshot";

// Per-dataset detail. "live" means it is fetched at request time and has no age
// of its own beyond its upstream's cache window.
export const FRESHNESS: Record<string, string> = {
  "treasury balance + intraday high (Dune, daily cron)": "live",
  "platform totals, leaderboards, songs, artists (wavewarz.info API)": "live",
  "Audius plays / YouTube": "live",
  "on-chain daily activity (Dune, from 2025-05-26)": "2026-09-05",
  "buys, sells, claims per day (chain scan)": "2026-09-05",
  "instruction mix (chain scan)": "2026-09-06",
  "platform volume timeline (per-battle, from 2025-05-28)": "2026-09-05",
  "program + treasury snapshot (lib/wwData.ts)": "2026-09-05",
  "SOL/USD reference price": "2026-09-08",
  "battle history file (recap tooling, npm run fetch:battles)": "2026-09-08",
  // Static /artist/* routes only - not on the homepage, so not in DATA_AS_OF.
  "artist roster for static routes (lib/leaderboard.ts)": "2026-06-15",
  "ops ledger + distributions (team-reported, manual)": "manual",
};
