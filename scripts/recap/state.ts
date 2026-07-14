import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { RecapState } from "./types";

const DEFAULT_STATE: RecapState = {
  recappedBattleIds: [],
  lastWeeklyRecapEnd: null,
  recappedShowDates: [],
};

export function readState(path: string): RecapState {
  if (!existsSync(path)) return { ...DEFAULT_STATE };
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return {
    recappedBattleIds: raw.recappedBattleIds ?? [],
    lastWeeklyRecapEnd: raw.lastWeeklyRecapEnd ?? null,
    recappedShowDates: raw.recappedShowDates ?? [],
  };
}

export function writeState(path: string, state: RecapState): void {
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function markBattleRecapped(state: RecapState, battleId: string): RecapState {
  if (state.recappedBattleIds.includes(battleId)) return state;
  return { ...state, recappedBattleIds: [...state.recappedBattleIds, battleId] };
}

export function markShowRecapped(state: RecapState, isoDate: string): RecapState {
  if (state.recappedShowDates.includes(isoDate)) return state;
  return { ...state, recappedShowDates: [...state.recappedShowDates, isoDate] };
}

export function advanceWeeklyCursor(state: RecapState, isoEnd: string): RecapState {
  return { ...state, lastWeeklyRecapEnd: isoEnd };
}
