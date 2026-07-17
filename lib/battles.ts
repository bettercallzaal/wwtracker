// WaveWarZ battles - verified aggregate stats from wavewarz.info (snapshot
// 2026-07-17). The per-battle feed is a virtualized client-side list that does
// not reliably full-scrape; aggregate stats + a recent sample are exact.

export interface RecentBattle {
  type: "MAIN" | "QUICK";
  a: string; b: string; winner: string; vol: number; date: string;
}

// Source: GET https://wavewarz.info/api/public/stats  (2026-07-17T01:36Z)
// battles: { total:1241, mainEvents:50, mainBattles:162, quickBattles:1043, communityBattles:36 }
// traderClaims: { totalSol:127.34, withdrawalCount:939 }
export const BATTLE_STATS = {
  events: 50,              // mainEvents (main tournament series)
  quickBattles: 1043,
  multiRound: 162,         // mainBattles (rounds inside main events)
  communityBattles: 36,
  totalShown: 1241,
  totalVolumeSol: 521.75,
  artistPayoutsSol: 9.05,
  platformRevenueSol: 17.38,
  traderClaimsSol: 127.34, // claimShares withdrawals — real trader winnings out
  withdrawalCount: 939,
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "MAIN", a: "AI LUI", b: "Benny J", winner: "AI LUI", vol: 17.6623, date: "Jun 8, 2026" },
  { type: "QUICK", a: "Simon Says Freestyle", b: "Hypnotic", winner: "Hypnotic", vol: 0.2013, date: "Jul 16, 2026" },
  { type: "QUICK", a: "KILLING FLOOR", b: "Ego death-Cannon Jones973 (Rocky diss)", winner: "KILLING FLOOR", vol: 0.288, date: "Jul 16, 2026" },
];
