// WaveWarZ battles - verified aggregate stats from wavewarz.info (snapshot
// 2026-07-18). The per-battle feed is a virtualized client-side list that does
// not reliably full-scrape; aggregate stats + a recent sample are exact.

export interface RecentBattle {
  type: "MAIN" | "QUICK";
  a: string; b: string; winner: string; vol: number; date: string;
}

export const BATTLE_STATS = {
  events: 50,         // mainEvents (COC-style show events) per /api/public/stats
  quickBattles: 1059, // quickBattles per /api/public/stats
  multiRound: 162,    // mainBattles (total MAIN matches played) per /api/public/stats
  totalShown: 1119,   // local feed count after 2026-07-18 refresh
  totalVolumeSol: 524.795,
  artistPayoutsSol: 9.1068,
  platformRevenueSol: 17.5978,
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "AI LUI", b: "Benny J", winner: "AI LUI", vol: 17.6623, date: "Jun 8, 2026" },
  { type: "MAIN", a: "Geek Myth", b: "Taji Kamikaze", winner: "Geek Myth", vol: 11.099, date: "Jun 11, 2026" },
  { type: "QUICK", a: "Fuck yo feelingZ", b: "Cannon Jones973- Alotta Hooks", winner: "Fuck yo feelingZ", vol: 0.9551, date: "Jul 17, 2026" },
  { type: "QUICK", a: "LoveUnderstandInspire", b: "Dale Vuelta 360", winner: "Dale Vuelta 360", vol: 0.3233, date: "Jul 18, 2026" },
];
