// WaveWarZ battles - verified aggregate stats from wavewarz.info/api/public/stats
// (snapshot 2026-07-29T06:37Z). Feed in public/ww-battles.json; run
// `npm run fetch:battles` to refresh. Live API source of truth for all totals.

export interface RecentBattle {
  type: "MAIN" | "QUICK" | "COMMUNITY";
  a: string; b: string; winner: string; vol: number; date: string;
}

// Source: GET https://wavewarz.info/api/public/stats (2026-07-29T06:37Z)
// battles: { total:1302, mainEvents:51, mainBattles:165, quickBattles:1101, communityBattles:36 }
// traderClaims: { totalSol:381.1971, withdrawalCount:1526 }
export const BATTLE_STATS = {
  events: 53,           // mainEvents (COC-style show events) per /api/public/stats
  quickBattles: 1291,
  multiRound: 171,      // mainBattles (MAIN matches played) per /api/public/stats
  communityBattles: 38,
  totalShown: 1500,     // total per live API (feed lags)
  totalVolumeSol: 921.29,
  artistPayoutsSol: 14.3465,
  // Upstream /api/public/stats no longer returns a platformRevenue object, so
  // this is the last value it ever reported (2026-06-15) and cannot be refreshed
  // by the documented method. Do not treat it as current - see docs/REFRESH.md.
  platformRevenueSol: 20.2008,
  traderClaimsSol: 408.73,   // cumulative claimShares withdrawals
  withdrawalCount: 1928,     // distinct claimShares transactions
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "AI LUI", b: "Benny J", winner: "AI LUI", vol: 17.6623, date: "Jun 8, 2026" },
  { type: "MAIN", a: "Geek Myth", b: "Taji Kamikaze", winner: "Geek Myth", vol: 11.099, date: "Jun 11, 2026" },
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "QUICK", a: "I Am Hondro", b: "Say ElTio", winner: "Say ElTio", vol: 0.26, date: "Aug 25, 2026" },
  { type: "QUICK", a: "Eat Away Dough", b: "BOUT THAiT!", winner: "Eat Away Dough", vol: 0.1369, date: "Aug 25, 2026" },
];
