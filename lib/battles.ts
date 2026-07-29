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
  events: 51,           // mainEvents (COC-style show events) per /api/public/stats
  quickBattles: 1101,
  multiRound: 165,      // mainBattles (MAIN matches played) per /api/public/stats
  communityBattles: 36,
  totalShown: 1302,     // total per live API (feed lags)
  totalVolumeSol: 878.8755,
  artistPayoutsSol: 13.4144,
  platformRevenueSol: 20.2008,
  traderClaimsSol: 381.1971,  // cumulative claimShares withdrawals
  withdrawalCount: 1526,     // distinct claimShares transactions
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "AI LUI", b: "Benny J", winner: "AI LUI", vol: 17.6623, date: "Jun 8, 2026" },
  { type: "MAIN", a: "Geek Myth", b: "Taji Kamikaze", winner: "Geek Myth", vol: 11.099, date: "Jun 11, 2026" },
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "QUICK", a: "GESD1", b: "WYFL Freestyle", winner: "GESD1", vol: 0.1212, date: "Jul 29, 2026" },
  { type: "QUICK", a: "Life Happens x JayStreetz x LUI", b: "For my PeopleZ", winner: "For my PeopleZ", vol: 0.1143, date: "Jul 29, 2026" },
];
