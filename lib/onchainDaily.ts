// The only correct way to read public/ww-onchain-daily.json.
//
// THAT FILE HAS `sells` AND `claims` TRANSPOSED. Measured 2026-09-08 against a
// complete chain scan, day by day across the 330 days both cover: the swap
// holds on 259 days (78%) and the straight reading on 22 (7%), and the pair
// TOTAL agrees on exactly the days the swap holds. The decoder sees every
// instruction and files two of them under each other's name.
//
// A pair transposition conserves every total, so no aggregate check can see it.
//
// WHY THIS MODULE EXISTS RATHER THAN A RULE. The correction was applied at
// scripts/ww-gen.mjs, which protects lib/wwData.ts and everything drawn from
// it - AboutWaveWarZ among them. But the file is also served to the browser at
// /ww-onchain-daily.json, and anything that fetches it directly gets the raw,
// wrong numbers. Two things did, and both shipped:
//
//   components/embeds/Widgets.tsx  published sellShares 3,409 / claimShares
//                                  2,762 on partner pages    (fixed 2026-09-09)
//   components/BattleLifecycle.tsx rendered 13,055 trades, 2,762 claims,
//                                  2.83 buys per sell and 1.72 claims per
//                                  settled battle - the claim count was the
//                                  sell count, and both ratios were wrong
//                                  (fixed 2026-09-09, four weeks after the
//                                  transposition was first written down)
//
// Four separate consumers needed the same correction and three of them missed
// it, because the correction lived in a build script rather than at the read.
// So it lives here now, and lib/__tests__/onchainDaily.test.ts fails the build
// if anything fetches that path without going through this module.

/** A day as the Dune-derived file stores it - `sells` and `claims` swapped. */
export interface RawOnchainDay {
  date: string;
  txs: number;
  traders: number;
  buys: number;
  sells: number;
  claims: number;
  created: number;
  settled: number;
  minted: number;
}

/** A day with the two instruction counts back under their real names. */
export type OnchainDay = RawOnchainDay;

export const ONCHAIN_DAILY_PATH = "/ww-onchain-daily.json";

/**
 * Swap the two transposed columns back.
 *
 * `txs`, `traders`, `created`, `settled` and `minted` are untouched - the
 * transposition is only between sells and claims, and `created` agrees with the
 * chain census exactly at 1,643, which is the evidence that the rest of the
 * decode is sound.
 */
export function correctDuneDay(d: RawOnchainDay): OnchainDay {
  return { ...d, sells: d.claims, claims: d.sells };
}

export function correctDuneDays(rows: RawOnchainDay[]): OnchainDay[] {
  return rows.map(correctDuneDay);
}

/** Fetch the daily series with the transposition already undone. */
export async function fetchOnchainDaily(): Promise<OnchainDay[]> {
  const res = await fetch(ONCHAIN_DAILY_PATH);
  if (!res.ok) throw new Error(`ww-onchain-daily.json returned HTTP ${res.status}`);
  return correctDuneDays((await res.json()) as RawOnchainDay[]);
}
