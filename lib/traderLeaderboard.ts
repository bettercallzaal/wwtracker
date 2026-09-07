// What the top-traders widget is allowed to show, and why one column is missing.
//
// The widget renders wavewarz.info's trader leaderboard. On 2026-09-07 that
// leaderboard was measured against a complete scan of every trade in the
// platform's history - 1,643 battles, 15,359 trades, read from Solana - and the
// two do not agree:
//
//   the site   145 wallets summing to +204.29 SOL of trader profit
//   chain      157 wallets summing to  -17.08 SOL
//
// Traders in aggregate must be down by roughly the fees taken out, which is what
// a fee is, so -17 is the figure with a mechanism behind it. The cause is not
// the platform's arithmetic - `payout - invested` is correct. It is that the
// underlying trades table is short: buys are 42.7% present by value, sells
// 46.5%, and the missing rows are about three times larger than the surviving
// ones, because hydration fetches a battle's whole trade history and skips the
// write on failure. The battles that fail are the biggest ones.
//
// The damage is concentrated rather than spread. One wallet - the largest trader
// on the platform - is displayed at +159.01 SOL while being -54.37 on chain, and
// that single row is 213 of the 221 SOL gap. Its volume is shown as 30.19 SOL
// against 280.15 measured.
//
// So: 45 of the 145 ranked wallets are shown in profit while down on chain, and
// per-wallet volume and win rate are computed from the same short rows.
//
// The full derivation, with the one query that would confirm or refute it, is in
// the protocol repo at recon/PNL-DIAGNOSIS.md. It has been raised with the
// record layer and the fix is theirs to run - a backfill, not a formula change.
//
// Why this file exists at all, rather than a comment in the widget: wwtracker's
// charter is that it never re-publishes a figure it has measured to be wrong.
// The trader P&L column was doing exactly that, on an embeddable widget, on
// somebody else's page, six days before the Grand Final - and one of the two
// finalists is the wallet above. A caveat in our docs does not travel with a
// screenshot of the widget. Removing the column does.
//
// Restore the column when the backfill has run and the two agree. The check is
// one command, in the protocol repo:
//
//   python3 tools/leaderboard-diff.py --trades trades.json --census census.json \
//       --site site_traders.json

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
  measuredOn: "2026-09-07",
  siteAggregateSol: 204.29,
  chainAggregateSol: -17.08,
  siteWallets: 145,
  chainWallets: 157,
  /** Ranked wallets displayed in profit that are down on chain. */
  shownInProfitButDown: 45,
  /** The largest single disagreement, in SOL. */
  largestWalletDeltaSol: 213.38,
} as const;

/**
 * Shown inside the widget frame, so it survives a screenshot of the widget.
 * Deliberately short - it sits in a 9.5px mono line on someone else's page.
 */
export const TRADER_PNL_NOTE =
  "Net P&L withdrawn 2026-09-07: measured against chain, 45 of 145 ranked wallets " +
  "are shown in profit while down. Volume and win rate come from the same rows.";

/** Columns the widget renders. `Net P&L` is absent by decision, not by oversight. */
export const TRADER_TABLE_HEAD = ["#", "Wallet", "Volume", "Win %"] as const;

/**
 * True while the upstream leaderboard is known to disagree with chain. Flip it
 * only alongside a fresh run of tools/leaderboard-diff.py that agrees.
 */
export const TRADER_PNL_WITHDRAWN = true;
