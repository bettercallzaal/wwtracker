// What the top-traders widget shows, and the history of the column that went.
//
// WITHDRAWN 2026-09-07. The widget rendered wavewarz.info's Net P&L straight
// through. Measured against a complete scan of every trade in the platform's
// history - 1,643 battles, 15,359 trades - the two did not agree:
//
//   the site   145 wallets summing to +204.29 SOL of trader profit
//   chain      157 wallets summing to  -17.08 SOL
//
// 45 of 145 ranked wallets were shown in profit while down on chain, and one -
// a Grand Final competitor - was displayed at +159.01 SOL while being 54.37
// down. The platform's arithmetic was never the problem; its trades table was
// short, because hydration fetched a battle's whole history and skipped the
// write on failure, losing the biggest battles first.
//
// RESTORED 2026-09-08, after the record layer backfilled and we audited it
// rather than took it on trust:
//
//   the site   157 wallets summing to  -21.46 SOL
//   chain      157 wallets summing to  -17.08 SOL
//   wallets shown in profit while down: 0
//   largest single disagreement: 0.70 SOL
//
// The remaining 4.38 SOL gap is not error. It is winnings earned on chain and
// never claimed: our figure models settlement as EARNED, theirs counts it as
// CLAIMED, and several wallets match to the lamport once unclaimed is
// subtracted. Theirs is the right definition for a page that says P&L, because
// somebody who has not claimed has not been paid.
//
// The rule that produced both decisions, unchanged: we do not re-publish a
// figure we have measured to be wrong, and we do not keep a column withdrawn
// once it is measured right. Both directions need the measurement.
//
// THESE CONSTANTS ARE A SNAPSHOT OF A LIVE CHECK, AND CANNOT NOTICE DRIFT.
//
// The tests below assert the column is only shown when the measurement says it
// agrees with chain - but the measurement is these hardcoded numbers. If the
// upstream leaderboard regresses tomorrow, the column keeps rendering and the
// tests keep passing, because the constants still say it is fine. That is the
// inverted alarm sitting inside the restore.
//
// So the condition is also registered as a live measurement, which hits the real
// leaderboard and fails if any of the four conditions stops holding:
//
//   zao-measure --verify "wwtracker: trader P&L restore verdict"
//
// It reports HOLDS, or DRIFTED if a condition flipped. The script behind it is
// tools/pnl-restore-check.py in the protocol repo, and it is deliberately NOT
// run offline - hitting the live site is the entire point, and a snapshot-only
// check here could never fail.
//
// Use the "verdict" label, not the older "condition" one. That one records the
// figures too, so it said DRIFTED on 2026-09-10 with all four conditions PASS -
// the aggregate had moved -21.46 to -20.63 on a night of trading. Re-verified
// that day: SAFE TO SHOW. The fourth condition is now set-based (no snapshot
// trader missing from the site); "wallet counts match 157/157" had matched by
// coincidence, one wallet swapped each way. Protocol PR #8.
//
// RE-CHECK BY 2026-09-13, before the Grand Final. Run it on the day - the check
// compares a live site to a 2026-09-06 snapshot, so it only gets weaker.

/** A row as the upstream leaderboard returns it. */
export interface TraderLeaderboardRow {
  wallet: string;
  totalVolumeSol: number;
  winRate: number;
  netPnlSol: number;
}

/**
 * The measurement that withdrew the column. Exported so the widget, the docs and
 * the tests all quote one set of numbers rather than three drifting copies.
 */
export const TRADER_PNL_MEASUREMENT = {
  measuredOn: "2026-09-08",
  siteAggregateSol: -21.46,
  chainAggregateSol: -17.08,
  siteWallets: 157,
  chainWallets: 157,
  /** Ranked wallets displayed in profit that are down on chain. */
  shownInProfitButDown: 0,
  /** The largest single disagreement, in SOL. */
  largestWalletDeltaSol: 0.7,
  /**
   * Of the 4.38 SOL aggregate gap, how much is explained by winnings that have
   * been earned on chain but never claimed. Our figure models settlement as
   * earned; the platform counts it as claimed, which is the correct definition
   * for a page that says P&L - somebody who has not claimed has not been paid.
   */
  unclaimedExplainsSol: 3.86,
} as const;

/**
 * What was withdrawn on 2026-09-07 and why, kept because a restored column with
 * no memory of why it went is how the same thing ships twice.
 */
export const TRADER_PNL_HISTORY = {
  withdrawnOn: "2026-09-07",
  restoredOn: "2026-09-08",
  siteAggregateWhenWithdrawn: 204.29,
  shownInProfitButDownWhenWithdrawn: 45,
  /** One wallet displayed at +159.01 while being -54.37 on chain. */
  worstSingleWalletDeltaSol: 213.38,
} as const;

/**
 * Shown inside the widget frame, so it survives a screenshot of the widget.
 * Deliberately short - it sits in a 9.5px mono line on someone else's page.
 */
export const TRADER_PNL_NOTE =
  "Net P&L restored 2026-09-08. Re-measured against a full chain scan: 0 of 157 " +
  "wallets now read profitable while down. Residual is unclaimed winnings.";

/** Columns the widget renders. */
export const TRADER_TABLE_HEAD = ["#", "Wallet", "Volume", "Win %", "Net P&L"] as const;

/**
 * True while the upstream leaderboard is known to disagree with chain. Flip it
 * only alongside a fresh run of tools/leaderboard-diff.py that agrees.
 */
export const TRADER_PNL_WITHDRAWN = false;
