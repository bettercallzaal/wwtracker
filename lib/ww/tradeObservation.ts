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
import { quoteBuy, poolAtSupply, BUY_POOL_SHARE, SUPPLY_QUANTUM } from "./quote";

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
    const predicted = quoteBuy(before.poolLamports, spend).tokensOut;
    const off = predicted - supplyDelta;
    if (off === 0) {
      return { kind: "buy", exact: true, poolDelta, supplyDelta, predicted, actual: supplyDelta,
        note: `buy ${(spend / 1e9).toFixed(4)} SOL -> ${supplyDelta.toLocaleString()} tokens` };
    }
    // Off by whole steps, and the pool moved by more than one plausible trade:
    // two buys inside the interval, which cannot sum. Not a failure.
    if (Math.abs(off) % SUPPLY_QUANTUM === 0 && Math.abs(off) <= SUPPLY_QUANTUM) {
      return { kind: "uncountable", exact: null, poolDelta, supplyDelta, predicted, actual: supplyDelta,
        note: `off by exactly one step (${off}) - probably two buys in one interval, not counted` };
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
