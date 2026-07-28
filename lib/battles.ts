// WaveWarZ battles - verified aggregate stats from wavewarz.info/api/public/stats
// (snapshot 2026-07-28T06:09Z). Feed in public/ww-battles.json; run
// `npm run fetch:battles` to refresh. Live API source of truth for all totals.

export interface RecentBattle {
  type: "MAIN" | "QUICK" | "COMMUNITY";
  a: string; b: string; winner: string; vol: number; date: string;
}

// Source: GET https://wavewarz.info/api/public/stats (2026-07-28T06:09Z)
// battles: { total:1298, mainEvents:51, mainBattles:165, quickBattles:1097, communityBattles:36 }
// traderClaims: { totalSol:381.1971, withdrawalCount:1526 }
export const BATTLE_STATS = {
  events: 51,           // mainEvents (COC-style show events) per /api/public/stats
  quickBattles: 1097,
  multiRound: 165,      // mainBattles (MAIN matches played) per /api/public/stats
  communityBattles: 36,
  totalShown: 1298,     // total per live API (feed lags)
  totalVolumeSol: 878.6027,
  artistPayoutsSol: 13.399,
  platformRevenueSol: 20.146,
  traderClaimsSol: 381.1971,  // cumulative claimShares withdrawals
  withdrawalCount: 1526,     // distinct claimShares transactions
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "MAIN", a: "AI LUI", b: "Benny J", winner: "AI LUI", vol: 17.6623, date: "Jun 8, 2026" },
  { type: "QUICK", a: "Simon Says Freestyle", b: "Hypnotic", winner: "Hypnotic", vol: 0.2013, date: "Jul 16, 2026" },
  { type: "QUICK", a: "KILLING FLOOR", b: "Ego death-Cannon Jones973 (Rocky diss)", winner: "KILLING FLOOR", vol: 0.288, date: "Jul 16, 2026" },
];
