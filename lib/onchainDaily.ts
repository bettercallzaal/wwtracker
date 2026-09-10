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
//
// AND IT COUNTS FAILED TRANSACTIONS. Found 2026-09-10: every surface reading
// this file rendered 428 failed attempts as trades. Buys, sells and claims now
// come from the chain scan per day; the measurement and the correction live in
// lib/onchainCorrect.mjs, shared with scripts/ww-gen.mjs.

import { correctDays } from "./onchainCorrect.mjs";

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

/**
 * A day with buys, sells and claims from the chain scan, and the rest from
 * Dune. `failedAttempts` is Dune's excess over chain for that day.
 */
export type OnchainDay = RawOnchainDay & { failedAttempts: number };

/** Successful instructions per UTC day, from the chain scan. */
export interface ChainDay {
  date: string;
  buys: number;
  sells: number;
  claims: number;
}

export interface ChainDaily {
  measuredThrough: string;
  days: ChainDay[];
}

export const ONCHAIN_DAILY_PATH = "/ww-onchain-daily.json";
export const CHAIN_DAILY_PATH = "/ww-chain-daily.json";

/**
 * Both corrections, from lib/onchainCorrect.mjs - the same module the build
 * script imports, so the read and the build cannot drift apart again. See that
 * file for the measurements.
 */
export function correctDuneDays(rows: RawOnchainDay[], chain: ChainDaily): OnchainDay[] {
  return correctDays(rows, chain) as OnchainDay[];
}

/** Fetch the daily series with both corrections already applied. */
export async function fetchOnchainDaily(): Promise<OnchainDay[]> {
  const [res, cres] = await Promise.all([fetch(ONCHAIN_DAILY_PATH), fetch(CHAIN_DAILY_PATH)]);
  if (!res.ok) throw new Error(`ww-onchain-daily.json returned HTTP ${res.status}`);
  // No fallback to Dune's own counts: that would be rendering failed attempts
  // as trades, which is the bug this exists to stop.
  if (!cres.ok) throw new Error(`ww-chain-daily.json returned HTTP ${cres.status}`);
  return correctDuneDays((await res.json()) as RawOnchainDay[], (await cres.json()) as ChainDaily);
}
