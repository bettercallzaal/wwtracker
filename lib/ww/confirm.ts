/**
 * Did the transaction actually land, or was it merely accepted for relay?
 *
 * WHAT WAS WRONG. `/api/ww/trade` returned `status: "sent"` the moment
 * `sendTransaction` returned a signature, and both the widget and the claim
 * panel showed a green "Sent" with that signature. `sendTransaction` confirms
 * only that a node accepted the transaction for broadcast. It can still never
 * land: the blockhash can expire between the build and block inclusion, the
 * transaction can be dropped under congestion, or the retries can run out. In
 * every one of those cases the person was told it happened.
 *
 * This is the same class as the three bugs found live on 2026-09-21 - a value
 * trusted before it has settled - one layer further out. There the value was a
 * balance; here it is "did my trade happen at all".
 *
 * THE THREE ANSWERS ARE KEPT APART, because two of them are not failures:
 *   landed    - the chain has it, with no error. Money moved.
 *   failed    - the chain has it and it errored. Money did not move, minus fee.
 *   unknown   - we could not tell in the time we waited. NOT a synonym for
 *               either: the transaction may still land seconds later, and
 *               telling somebody it failed would be a lie they might act on.
 *
 * Pure: the status read is an argument, so the whole ladder is testable
 * without a network.
 */

export type ConfirmOutcome = "landed" | "failed" | "unknown";

export interface ConfirmResult {
  outcome: ConfirmOutcome;
  /** The chain's own error, when it errored. */
  error: string | null;
  /** What the RPC last reported: processed, confirmed, finalized, or null. */
  confirmationStatus: string | null;
  attempts: number;
}

/** The shape of one entry of getSignatureStatuses' value array. */
export interface SignatureStatus {
  slot?: number;
  confirmations?: number | null;
  err?: unknown;
  confirmationStatus?: string | null;
}

/**
 * A status is good enough to call landed at "confirmed": the cluster has voted
 * on the block. "processed" is a single node's word and can still be forked
 * away, so it is reported as still-unknown rather than as landed.
 */
export function isLanded(s: SignatureStatus | null | undefined): boolean {
  if (!s || s.err) return false;
  return s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized";
}

export async function confirmSignature(p: {
  /** Reads the status. Called once per attempt; null means the RPC has never seen it. */
  readStatus: () => Promise<SignatureStatus | null>;
  attempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<ConfirmResult> {
  const attempts = Math.max(1, p.attempts ?? 12);
  const delayMs = p.delayMs ?? 2_000;
  const sleep = p.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: SignatureStatus | null = null;
  for (let i = 1; i <= attempts; i++) {
    last = await p.readStatus();
    if (last?.err) {
      return {
        outcome: "failed",
        error: typeof last.err === "string" ? last.err : JSON.stringify(last.err).slice(0, 200),
        confirmationStatus: last.confirmationStatus ?? null,
        attempts: i,
      };
    }
    if (isLanded(last)) {
      return { outcome: "landed", error: null, confirmationStatus: last!.confirmationStatus ?? null, attempts: i };
    }
    if (i < attempts) await sleep(delayMs);
  }
  return { outcome: "unknown", error: null, confirmationStatus: last?.confirmationStatus ?? null, attempts };
}

/** What to show a person for each outcome. Kept here so both panels say the same thing. */
export function describeConfirmation(r: ConfirmResult, signature: string): string {
  const sig = `${signature.slice(0, 8)}...${signature.slice(-8)}`;
  if (r.outcome === "landed") return `Confirmed on chain (${sig}).`;
  if (r.outcome === "failed") return `The chain rejected it: ${r.error ?? "unknown error"} (${sig}).`;
  return `Sent, but not confirmed yet after ${r.attempts} checks (${sig}). It may still land; check the signature before trying again.`;
}
