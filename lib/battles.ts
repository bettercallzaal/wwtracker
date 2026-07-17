// WaveWarZ battles - verified aggregate stats from wavewarz.info/api/public/stats
// Source: 2026-07-17T17:15:14Z

export interface RecentBattle {
  type: "MAIN" | "QUICK";
  a: string; b: string; winner: string; vol: number; date: string;
}

export const BATTLE_STATS = {
  events: 50,
  quickBattles: 1047,
  multiRound: 162,
  communityBattles: 36,
  totalShown: 1245,
  totalVolumeSol: 524.15,
  artistPayoutsSol: 9.07,
  platformRevenueSol: 17.44,
  traderClaimsSol: 127.34,
  withdrawalCount: 939,
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "MAIN", a: "Geek Myth", b: "Taji Kamikaze", winner: "Geek Myth", vol: 11.099, date: "Jun 14, 2026" },
  { type: "QUICK", a: "Fuck yo feelingZ", b: "ACCELERATE", winner: "Fuck yo feelingZ", vol: 0.261, date: "Jun 13, 2026" },
  { type: "QUICK", a: "The Decay (Greasy Thoughts II)", b: "Ashes", winner: "Ashes", vol: 0.0295, date: "Jun 13, 2026" },
];
