// Whether a battle is actually running, which is not the same question as
// whether it has settled.
//
// `/api/ww/positions` derived `running` as `!settled`, and the account's settled
// flag is only set when somebody calls the settlement instruction. Nothing
// obliges anyone to. So a battle whose trading window closed and which was then
// abandoned reports as running forever.
//
// Measured on the committed census, 2026-09-08:
//
//   93 of 1,643 battles have winner_decided false
//   93 of those 93 have an end_time in the past
//    0 are genuinely still running
//   23 of them carried real money
//   the oldest ended 2025-06-06, fifteen months ago
//
// So every battle the old flag called running had in fact ended, and one of them
// rendered on /live as a live battle 298 days after its window closed. The flag
// was not merely imprecise; it was never right.
//
// Three states, because "not settled" hides two very different things:
//
//   running   the window is open. Positions are live and change.
//   expired   the window closed and nobody settled it. Positions are frozen,
//             holders still hold, and nothing further will happen without a
//             settlement call. This is the state that was being mislabelled.
//   settled   paid out.

export type BattlePhase = "running" | "expired" | "settled";

/**
 * @param settled the account's settled flag
 * @param endTime unix seconds
 * @param nowSeconds unix seconds, injected so this stays pure and testable
 */
export function battlePhase(
  settled: boolean,
  endTime: number,
  nowSeconds: number,
): BattlePhase {
  if (settled) return "settled";
  // A battle is running up to and including its end second, and the account's
  // own end_time is the authority - not a client clock, and not a duration
  // recomputed from start.
  return nowSeconds <= endTime ? "running" : "expired";
}

/** How long ago the window closed, in whole days. Negative while it is open. */
export function daysSinceEnd(endTime: number, nowSeconds: number): number {
  return Math.floor((nowSeconds - endTime) / 86400);
}
