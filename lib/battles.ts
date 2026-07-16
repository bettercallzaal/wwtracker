// WaveWarZ battles - verified aggregate stats from wavewarz.info/api/public/stats
// (snapshot 2026-07-16). The per-battle feed is in public/ww-battles.json (run
// `npm run fetch:battles` to refresh). Live stats: GET /api/public/stats.

export interface RecentBattle {
  type: "MAIN" | "QUICK";
  a: string; b: string; winner: string; vol: number; date: string;
}

// Source: GET https://wavewarz.info/api/public/stats  (2026-07-16T22:18Z)
// battles: { total:1240, mainEvents:50, mainBattles:162, quickBattles:1042, communityBattles:36 }
export const BATTLE_STATS = {
  events: 50,           // mainEvents (main tournament series)
  quickBattles: 1042,
  multiRound: 162,      // mainBattles (rounds inside main events)
  totalShown: 1240,
  totalVolumeSol: 521.74,
  artistPayoutsSol: 9.05,
  platformRevenueSol: 17.37,
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "MAIN", a: "AI LUI", b: "Benny J", winner: "AI LUI", vol: 17.6623, date: "Jun 8, 2026" },
  { type: "QUICK", a: "Simon Says Freestyle", b: "Hypnotic", winner: "Hypnotic", vol: 0.2013, date: "Jul 16, 2026" },
  { type: "QUICK", a: "KILLING FLOOR", b: "Ego death-Cannon Jones973 (Rocky diss)", winner: "KILLING FLOOR", vol: 0.288, date: "Jul 16, 2026" },
];
