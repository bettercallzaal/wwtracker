/**
 * Classify a change in a battle account as a trade, and say whether our curve
 * predicted it.
 *
 * **THIS EXISTS BECAUSE IT WAS UNTESTABLE WHERE IT WAS.** The logic lived inside
 * the live watcher's poll loop, closed over its counters, and on the evening of
 * the finals its tally still read `0 exact, 0 mismatched, 0 uncountable` - it
 * had never executed. It would have run for the first time on a real trade,
 * during a show, with nobody able to tell a wrong verdict from a right one.
 * Pulled out here it is a pure function of two account reads, and the cases
 * below are exercised against numbers taken off the chain.
 *
 * WHAT IT CANNOT SEE, stated rather than hidden. Two trades inside one poll
 * interval do not sum: each mints a floored step, so two steps of flooring is
 * not one. Those come back `uncountable` and belong in neither the pass nor the
 * fail column. A denominator that quietly absorbs them is worse than a smaller
 * one.
 */
import { quoteBuyAtSupply, poolAtSupply, BUY_POOL_SHARE, SUPPLY_QUANTUM } from "./quote";

export interface BattleSide {
  poolLamports: number;
  supply: number;
}

export type TradeObservationKind = "buy" | "sell" | "none" | "uncountable";

export interface TradeObservation {
  kind: TradeObservationKind;
  /** Did our model reproduce what the program did? `null` when not countable. */
  exact: boolean | null;
  /** Lamports that entered or left the pool. Positive on a buy. */
  poolDelta: number;
  /** Tokens minted or burned. Positive on a buy. */
  supplyDelta: number;
  /** What we predicted, in the unit that side of the trade is measured in. */
  predicted: number | null;
  /** What the program did, same unit. */
  actual: number | null;
  /** Plain words, for a log line a person reads mid-show. */
  note: string;
}

/**
 * The spend that produced a pool movement. A buy puts 98.5% of it in.
 */
export const spendForPoolDelta = (poolDelta: number): number =>
  Math.round(poolDelta / BUY_POOL_SHARE);

export function observe(before: BattleSide, after: BattleSide): TradeObservation {
  const poolDelta = after.poolLamports - before.poolLamports;
  const supplyDelta = after.supply - before.supply;

  if (poolDelta === 0 && supplyDelta === 0) {
    return { kind: "none", exact: null, poolDelta, supplyDelta, predicted: null, actual: null, note: "no change" };
  }

  // Pool and supply must move the same way. Anything else is two trades
  // cancelling inside one interval, or a read that straddled a write.
  if (Math.sign(poolDelta) !== Math.sign(supplyDelta)) {
    return {
      kind: "uncountable", exact: null, poolDelta, supplyDelta, predicted: null, actual: null,
      note: `pool ${poolDelta >= 0 ? "+" : ""}${poolDelta} against supply ${supplyDelta >= 0 ? "+" : ""}${supplyDelta} - mixed direction, more than one trade`,
    };
  }

  if (poolDelta > 0) {
    const spend = spendForPoolDelta(poolDelta);
    // FROM THE SUPPLY THE SIDE HELD, not the pool the vault held. A buy is
    // minted off the pool the stored supply implies (see `quote.ts`), and
    // `before.supply` is right here - the sell branch below has always used
    // it. Replayed over every sample this watcher has ever stored, 135 pool-up
    // moves: the pool form reproduces 102, this one reproduces 135.
    const predicted = quoteBuyAtSupply(before.supply, spend).tokensOut;
    const off = predicted - supplyDelta;
    if (off === 0) {
      return { kind: "buy", exact: true, poolDelta, supplyDelta, predicted, actual: supplyDelta,
        note: `buy ${(spend / 1e9).toFixed(4)} SOL -> ${supplyDelta.toLocaleString()} tokens` };
    }
    /**
     * THIS BRANCH WAS ABSORBING THE MODEL'S OWN ERROR, and that is why the
     * watcher kept reporting 0 mismatched.
     *
     * "Off by exactly one step" was read as two buys inside one interval,
     * which cannot sum. It is ALSO the exact signature of the pool-based
     * quote, which is wrong by one 100,000 step on about one buy in five - so
     * every one of those failures was being routed here and counted as
     * uncountable rather than as a mismatch. The reassuring number came from
     * the escape hatch, not from the model.
     *
     * With the supply-based quote above, NONE of the 135 stored pool-up moves
     * lands here. Two buys in one interval remains physically possible, so the
     * branch stays - but it is no longer the explanation for anything
     * observed, and if it starts firing that is worth looking at rather than
     * shrugging at.
     */
    if (Math.abs(off) % SUPPLY_QUANTUM === 0 && Math.abs(off) <= SUPPLY_QUANTUM) {
      return { kind: "uncountable", exact: null, poolDelta, supplyDelta, predicted, actual: supplyDelta,
        note: `off by exactly one step (${off}) - two buys in one interval, not counted. Unobserved since the quote was corrected.` };
    }
    return { kind: "buy", exact: false, poolDelta, supplyDelta, predicted, actual: supplyDelta,
      note: `MISMATCH on a buy: ours ${predicted.toLocaleString()}, program ${supplyDelta.toLocaleString()}, off ${off}` };
  }

  // A sell burns tokens and releases the curve value of them from the pool.
  const sold = -supplyDelta;
  const released = -poolDelta;
  const predicted = Math.round(poolAtSupply(before.supply) - poolAtSupply(before.supply - sold));
  const off = predicted - released;
  // One lamport of rounding is the documented divergence, not a defect.
  if (Math.abs(off) <= 1) {
    return { kind: "sell", exact: true, poolDelta, supplyDelta, predicted, actual: released,
      note: `sell ${sold.toLocaleString()} tokens -> ${(released / 1e9).toFixed(6)} SOL out of the pool` };
  }
  return { kind: "sell", exact: false, poolDelta, supplyDelta, predicted, actual: released,
    note: `MISMATCH on a sell: ours ${predicted}, program ${released}, off ${off}` };
}
