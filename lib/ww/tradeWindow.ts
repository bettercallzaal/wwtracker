/**
 * WHEN A BATTLE CAN ACTUALLY BE TRADED, which is not when it starts.
 *
 * **The program refuses every buy until `start_time` + 60 seconds.** Measured
 * 2026-09-24 by simulating a launch and a buy in one transaction against the
 * CHAIN clock rather than the wall clock, so the age reported is the age the
 * program sees:
 *
 *     age of start_time at simulation   result
 *     51s                               BattleNotActive (6003)
 *     55s                               BattleNotActive (6003)
 *     58s                               BattleNotActive (6003)
 *     59s                               BattleNotActive (6003)
 *     61s                               buy accepted
 *
 * The refusal comes from `lib.rs:523`, one check BEFORE the end-time check at
 * `lib.rs:527` that returns `BattleEnded` - confirmed by pointing the same buy
 * at a real finished battle, which reached 527 and reported `BattleEnded`. So
 * the construction is sound and 523 is a start gate, not a mistake of ours.
 *
 * THIS CORRECTS A CONCLUSION THIS REPO PUBLISHED EARLIER THE SAME DAY.
 * `openingGap.ts` measured the first trade landing 66 to 67 seconds after
 * `start_time` across every battle, a floor so tight it survived a 22-second
 * swing in when the mints were ready, and concluded: "whatever the first buyer
 * is timing off tracks the id's timestamp, not the moment the battle became
 * tradeable."
 *
 * **That was wrong, and the right answer is duller and more important.** The
 * first buyer is not timing off anything. The program will not accept a buy
 * before 60 seconds have passed, so no trade CAN land earlier, and the floor
 * is the protocol's, not the population's. 60s of gate plus a few seconds of
 * propagation is the 66s that was measured. The earlier reading invented an
 * actor to explain a constant.
 *
 * WHAT IT MEANS FOR THE ANNOUNCEMENT LAG, which is the open fairness question.
 * The working figure for how long the host trails the chain is about 45
 * seconds, and it has never been measured. If it is anywhere under 60, then
 * **the announcement happens while trading is still impossible for everyone**,
 * and the advantage it was feared to create cannot exist. That does not settle
 * the question - 45 is an estimate, not a measurement, and this only bounds
 * the part of it that matters - but it changes what the measurement would
 * mean.
 */

/** Seconds after `start_time` before the program accepts a buy. Measured, not documented. */
export const BUY_OPENS_AFTER_START_SECONDS = 60;

/**
 * The first moment a battle can actually be traded.
 *
 * Both conditions must hold: the mints must exist (a buy needs them, and
 * `initializeBattle` does not create them), AND the 60-second gate must have
 * passed. Whichever is later is the answer.
 *
 * `mintsReadyTime` may be null when it could not be established. The result is
 * then null too, rather than falling back to the gate alone: a battle whose
 * mints landed late would get an answer that is too early, and too early is
 * the direction that invents trading opportunities nobody had.
 */
export function tradeableFrom(startTime: number, mintsReadyTime: number | null): number | null {
  if (mintsReadyTime === null) return null;
  return Math.max(mintsReadyTime, startTime + BUY_OPENS_AFTER_START_SECONDS);
}

/** Which of the two conditions was the binding one, for a report that has to explain itself. */
export function bindingConstraint(
  startTime: number,
  mintsReadyTime: number | null,
): "gate" | "mints" | "unknown" {
  if (mintsReadyTime === null) return "unknown";
  return startTime + BUY_OPENS_AFTER_START_SECONDS >= mintsReadyTime ? "gate" : "mints";
}
