// WaveWarZ battles - verified aggregate stats from wavewarz.info/api/public/stats
// (snapshot 2026-07-23T10:08Z). Feed in public/ww-battles.json; run
// `npm run fetch:battles` to refresh. Live API source of truth for all totals.

export interface RecentBattle {
  type: "MAIN" | "QUICK";
  a: string; b: string; winner: string; vol: number; date: string;
}

// Source: GET https://wavewarz.info/api/public/stats (2026-07-23T10:08Z)
// battles: { total:1285, mainEvents:51, mainBattles:165, quickBattles:1084, communityBattles:36 }
export const BATTLE_STATS = {
  events: 51,           // mainEvents (COC-style show events) per /api/public/stats
  quickBattles: 1084,
  multiRound: 165,      // mainBattles (MAIN matches played) per /api/public/stats
  totalShown: 1285,     // total per live API (feed lags by ~141 battles)
  totalVolumeSol: 878.316,
  artistPayoutsSol: 13.3918,
  platformRevenueSol: 19.9867,
};

export const RECENT_BATTLES: RecentBattle[] = [
  { type: "MAIN", a: "AI LUI", b: "Benny J", winner: "AI LUI", vol: 17.6623, date: "Jun 8, 2026" },
  { type: "MAIN", a: "Stella Estrella", b: "Aporkalypse", winner: "Stella Estrella", vol: 3.4257, date: "Jun 15, 2026" },
  { type: "QUICK", a: "Signals", b: "Sunflower Seedz", winner: "Sunflower Seedz", vol: 1.208, date: "Jul 23, 2026" },
  { type: "QUICK", a: "Fuck yo feelingZ", b: "Cannon Jones973- Alotta Hooks", winner: "Fuck yo feelingZ", vol: 0.9551, date: "Jul 17, 2026" },
];
