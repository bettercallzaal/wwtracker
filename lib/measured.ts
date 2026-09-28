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

/**
 * Lifetime trading volume, buys plus sells, from the chain scan - 1,643 of 1,643
 * battles, 15,374 trade records.
 *
 * Was 928.21 until 2026-09-10, from a scan that was really 1,642 battles: battle
 * 1786157311 sat in the snapshot as a DNS error recorded as done (wavewarz-protocol
 * PR #11, tools/snapshot-check.py). Filled from the same 2026-09-06 snapshot, so
 * MEASURED_ON stays; only this figure moved at two decimals.
 */
export const VOLUME_SOL = 928.52;

/**
 * DO NOT QUOTE THE PUBLIC API'S VOLUME AS A LIFETIME TOTAL. IT IS NOT ONE.
 *
 * `volume.totalSol` from `wavewarz.info/api/public/stats` is the figure every
 * outside surface reaches for, and its name says cumulative. It is not:
 *
 *   2026-09-06   922.30 SOL
 *   2026-09-19   921.99 SOL   <- FELL by 0.31 between reads
 *   2026-09-23   954.49 SOL
 *   2026-09-27   957.07 SOL
 *
 * A lifetime cumulative cannot fall. So that field is a recomputation over
 * whatever their indexer currently holds, and it moves in both directions as
 * that population changes. Treating any single read as "N SOL traded, all
 * time" states a property the number does not have.
 *
 * THE MECHANISM, caught in the act on 2026-09-27. The daily refresh branch that
 * day changed exactly one line of `public/ww-battles.json`:
 *
 *     battle 1758503315, "$BONGA: VibeLord" vs "$STUPID: Atchblockbaby",
 *     dated Sep 22 2025:   vol 2.1584  ->  0.1462
 *
 * A battle from over a year earlier had its recorded volume revised DOWN by
 * 2.0122 SOL, in a single day's refresh. Exactly one row changed and the row
 * count did not move: the file summed 959.0753 before and 957.0631 after. That
 * is the whole 2.01 SOL gap between the 959.08 written into the resume PR and
 * the 957.0655 the endpoint served when two lanes checked it.
 *
 * THIS FIRST SHIPPED NAMING THE WRONG BATTLE - 1758501426, whose volume has
 * been 2.1109 since 2026-09-09 and never moved. The Vault lane caught it by
 * reading the id out of this file and finding a third value. The cause was
 * reading a unified diff through `grep` for the interesting field names: `id`
 * is the FIRST key in each record and `vol` the ninth, so the id that appeared
 * below the changed line belonged to the NEXT record. There are three battles
 * for this same pairing on this same date - 1758501426, 1758503315, 1758505532,
 * adjacent in the file - so the wrong answer was indistinguishable from the
 * right one by eye. A structural diff keyed on id gives one changed row and no
 * ambiguity; that is how the number below is now produced.
 *
 * So the fall is not noise and not a reindexing blip in recent data. Battles
 * that closed a year ago are still being restated, which means the total over
 * them is a current opinion rather than a running sum.
 *
 * THE INVALIDATION CONDITION, rather than a date: this figure is safe to quote
 * only where the sentence around it survives the number going DOWN. "As of
 * <date>, the public API reports N SOL" survives it. "N SOL traded" does not,
 * and neither does anything with a plus sign after it.
 *
 * Found 2026-09-27 verifying four figures headed for a resume
 * (bettercallzaal/bettercallzaalwebsite#51), where 959.08 SOL had been written
 * as a durable claim. Two lanes re-read the endpoint 113 seconds apart and got
 * different dollar totals from the same SOL figure, because the price field
 * moved between them. The history above is from docs/ECOSYSTEM.md, which had
 * recorded the fall and called it "rising again after the drop" without
 * noticing that the drop was the finding.
 *
 * `VOLUME_SOL` above does not have this problem: it comes from our own scan of
 * a fixed snapshot, so re-running it on the same snapshot gives the same
 * answer, and MEASURED_ON says which snapshot.
 */
export const PUBLIC_API_VOLUME_READS: ReadonlyArray<{ on: string; totalSol: number }> = [
  { on: "2026-09-06", totalSol: 922.30 },
  { on: "2026-09-19", totalSol: 921.99 },
  { on: "2026-09-23", totalSol: 954.49 },
  { on: "2026-09-27", totalSol: 957.07 },
];

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

/**
 * Comma-formatted forms, for prose.
 *
 * These exist because the surfaces that state these facts were retyping them.
 * On 2026-09-09 a sweep found 18 hand-typed copies of the constants above in
 * app/case-study/page.tsx alone - including the meta description and both
 * social cards, which are the highest-reach strings on the site - plus more in
 * app/ecosystem/page.tsx and lib/surfaces.ts, neither of which imported this
 * file at all.
 *
 * Every one of them was CORRECT that day. That is the point: they were correct
 * the day #241 landed too, and #243 existed only because a sibling block in the
 * same file was not. A retyped figure is not wrong yet, it is wrong on the next
 * re-measure, and the seven defects fixed on 2026-09-09 were all this shape - a
 * correction reaching one copy and not another.
 *
 * So: never write `1,643` in a surface. Write `M.BATTLES_ON_CHAIN_FMT`.
 */
const fmt = (n: number) => n.toLocaleString("en-US");

export const BATTLES_ON_CHAIN_FMT = fmt(BATTLES_ON_CHAIN);
export const BATTLES_PUBLIC_FMT = fmt(BATTLES_PUBLIC);
export const ARTIST_WALLETS_FMT = fmt(ARTIST_WALLETS);
