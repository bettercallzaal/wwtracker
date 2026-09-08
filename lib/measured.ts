// The headline figures, in one place, with the date they were measured on.
//
// Convention 20: a published figure names its legs and its measurement date, and
// is regenerated rather than copied forward. This file is that convention made
// enforceable - every surface imports from here, so a figure cannot be correct in
// one place and stale in another, and updating the measurement is one edit
// instead of a search.
//
// The defect this exists to prevent has now shipped three times on this site:
// the case-study FAQ answer, the CITABLE_FACTS block beside it, and the Dataset
// schema in app/layout.tsx - which is on EVERY page. Each was independently
// hand-maintained and each drifted, in the same direction, because a figure
// copied into prose has no way to know it went stale.
//
// HOW TO UPDATE. Re-run the measurement, do not adjust these by hand:
//
//   cd wavewarz-protocol/data/chain-snapshot-2026-09-06
//   python3 ../../tools/census.py                 # battles, volume
//   python3 ../../tools/artist-earnings.py --census census.json --trades trades.json
//
// then set MEASURED_ON to the day you ran it. The tests in
// lib/__tests__/measured.test.ts fail if the surfaces disagree with these values.

/** The day every figure below was read from chain. Update with the figures, never alone. */
export const MEASURED_ON = "2026-09-07";
/** The same date in the prose form the copy uses. */
export const MEASURED_ON_LONG = "7 September 2026";
/** The short form used where space is tight. */
export const MEASURED_ON_SHORT = "7 Sep 2026";

/** Battle accounts that exist on mainnet. `getProgramAccounts`, whole population. */
export const BATTLES_ON_CHAIN = 1643;

/**
 * Battles the public API returns. Lower than the chain count on purpose - 93 are
 * test battles filtered from every listing, and the rest are creations that never
 * produced an index row. The gap runs one way: no API battle is missing from
 * chain.
 */
export const BATTLES_PUBLIC = 1501;

/** Lifetime trading volume, buys plus sells, from the complete 15,359-trade scan. */
export const VOLUME_SOL = 928.21;

/**
 * To artists, all three legs. Do not quote this without the legs - it lands within
 * 0.1% of the whole trade fee by coincidence, so the bare number cannot tell an
 * artist total apart from a platform-and-artist total.
 */
export const ARTIST_TOTAL_SOL = 13.94;
/** Of that: the artist's 67% share of the 1.500% trade fee, so 1.005% of volume. */
export const ARTIST_FEE_LEG_SOL = 9.33;
/** Of that: 5% of the losing pool to the winner, 2% to the loser. INHERITED split. */
export const ARTIST_SETTLEMENT_LEG_SOL = 4.61;

/** Platform revenue from every source. Mostly queue fees, which do not scale with volume. */
export const PLATFORM_REVENUE_SOL = 19.34;
/** Of that: queue-jump fees. INHERITED from the record layer's treasury_fee_events. */
export const QUEUE_FEES_SOL = 12.77;

/** Distinct artist wallets that have ever competed. */
export const ARTIST_WALLETS = 120;
/** Of those, how many appear on the public leaderboard. Fetched live 2026-09-07. */
export const RANKED_ARTISTS = 52;

/** First and last battle start times seen on chain, as month names. */
export const SPAN_FIRST = "May 2025";
export const SPAN_LAST = "Sep 2026";

/**
 * SOL price used for any USD figure, and the day it was taken. USD moves without
 * anything on chain changing, so it never appears without both.
 *
 * RE-EXPORTED, never redefined. This file carried its own SOL_USD = 180 until
 * 2026-09-08 while lib/price.ts said 101.9, both stamped the same day. Two
 * constants for one quantity is how they drift, and the one in the file named
 * "measured" was the one nobody had measured.
 */
export { SOL_USD, SOL_USD_AS_OF } from "./price";
import { SOL_USD as PRICE } from "./price";

/** Volume in USD at the reference price. Derived, never hand-written. */
export const VOLUME_USD = Math.round(VOLUME_SOL * PRICE);
