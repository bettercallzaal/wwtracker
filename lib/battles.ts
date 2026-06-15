// WaveWarZ battles - verified aggregate stats from wavewarz.info (snapshot
// 2026-06-15). The per-battle feed is a virtualized client-side list that does
// not reliably full-scrape; aggregate stats + a recent sample are exact.

export interface RecentBattle {
  type: "MAIN" | "QUICK";
  a: string; b: string; winner: string; vol: number; date: string;
}

export const BATTLE_STATS = {
  events: 72,
  quickBattles: 886,
  multiRound: 51,
  totalShown: 958,
  totalVolumeSol: 484.46,
  artistPayoutsSol: 8.66,
  platformRevenueSol: 15.3,
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "MAIN", a: "Geek Myth", b: "Taji Kamikaze", winner: "Geek Myth", vol: 11.099, date: "Jun 14, 2026" },
  { type: "QUICK", a: "Fuck yo feelingZ", b: "ACCELERATE", winner: "Fuck yo feelingZ", vol: 0.261, date: "Jun 13, 2026" },
  { type: "QUICK", a: "The Decay (Greasy Thoughts II)", b: "Ashes", winner: "Ashes", vol: 0.0295, date: "Jun 13, 2026" },
];
