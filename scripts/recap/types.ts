export type BattleType = "MAIN" | "QUICK" | "COMMUNITY" | "UNCLASSIFIED";

export interface StoredBattle {
  id: string;
  type: BattleType;
  date: string; // display format, e.g. "Jun 15, 2026" - matches public/ww-battles.json
  a: string;
  b: string;
  aHandle: string | null;
  bHandle: string | null;
  winner: string;
  vol: number;
  margin: number | null;
}

export interface ScrapedBattle {
  battleId: number;
  date: string | null;
  song1Title: string | null;
  song2Title: string | null;
  song1Handle: string | null;
  song2Handle: string | null;
  winnerTitle: string | null;
  loserTitle: string | null;
  totalVolumeSol: number | null;
  marginPct: number | null;
}

export interface SpeakerLogEntry {
  timestampSec: number;
  speaker: string;
  captionText?: string;
}

export interface RecapDraft {
  farcaster: string;
  x: string;
  dataUsed: string[];
  notIncluded: string[];
}

export interface RecapState {
  recappedBattleIds: string[];
  lastWeeklyRecapEnd: string | null;
  recappedShowDates: string[];
}
