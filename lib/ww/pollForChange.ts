/**
 * Read again until the answer changes, or give up and say so.
 *
 * WHY THIS EXISTS, and it cost the first live sell. After a trade landed, the
 * widget re-read the wallet's token balance ONCE, immediately, and an RPC that
 * has not yet processed the transaction answers 0 - correctly, for the moment
 * it was asked. The widget then showed "This wallet holds nothing on Artist A
 * in this battle" while the chain held 10,800,000 tokens, and the Sell tab was
 * unusable. Measured 2026-09-21 on battle 1790043661: our own
 * /api/ww/token-balance returned the right number seconds later.
 *
 * A single read at the wrong moment is the same defect shape as the stale
 * pool the trade planner exists to fix. The answer is the same: make the
 * timing an argument, so a test can drive it.
 *
 * It returns the LAST value read even when nothing changed, so a caller can
 * show something true ("still reads 0") rather than nothing.
 */
export interface PollResult<T> {
  value: T;
  changed: boolean;
  attempts: number;
}

export async function pollForChange<T>(p: {
  /** Reads the value. Called once per attempt. */
  read: () => Promise<T>;
  /** The value to move away from. */
  from: T;
  /** Same-value test. Defaults to Object.is. */
  same?: (a: T, b: T) => boolean;
  /** Total attempts, including the first. */
  attempts?: number;
  /** Milliseconds between attempts. */
  delayMs?: number;
  /** Injectable only so a test does not wait. */
  sleep?: (ms: number) => Promise<void>;
}): Promise<PollResult<T>> {
  const same = p.same ?? ((a: T, b: T) => Object.is(a, b));
  const attempts = Math.max(1, p.attempts ?? 8);
  const delayMs = p.delayMs ?? 1_500;
  const sleep = p.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let value = p.from;
  for (let i = 1; i <= attempts; i++) {
    value = await p.read();
    if (!same(value, p.from)) return { value, changed: true, attempts: i };
    if (i < attempts) await sleep(delayMs);
  }
  return { value, changed: false, attempts };
}
