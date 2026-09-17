/**
 * What the trade relay will and will not forward.
 *
 * The relay exists because `SOLANA_RPC_URL` is a keyed endpoint that must stay
 * server-side - putting it in browser code publishes it, and that one key is
 * what keeps the /live page up (see lib/redact.ts). So the browser hands us a
 * signed transaction and we forward it.
 *
 * Which makes this an open relay unless something stops it. Anyone can POST,
 * so without a policy the endpoint is a free, keyed, rate-limit-funded RPC for
 * sending ANY transaction on Solana - paid for by us and attributable to us.
 * This module is that policy, kept separate from the route so the decision is
 * unit-testable rather than tangled in request handling.
 *
 * Two rules, and the second is the one that matters:
 *
 *   1. Every instruction must target an allowed program.
 *   2. At least one must be a WaveWarZ trade - buy, sell or claim - identified
 *      by discriminator. A transaction that merely mentions our program without
 *      trading is not ours to pay for.
 *
 * Rule 2 also excludes `initializeBattle` and `endBattle`. Those are the
 * platform's to sign, not a trader's, and relaying one through our key would
 * launch or settle a battle in our name.
 *
 * WHY LIGHTHOUSE IS ALLOWED, because it looks like a hole and is not. Phantom
 * injects Lighthouse (`L2TExMF...`) assertions into a transaction BEFORE it
 * signs, so they are inside the signed message and a policy that rejected them
 * would reject every real Phantom trade. Measured on the mainnet buy in
 * `lib/__fixtures__`: six instructions, three of them Lighthouse. They assert
 * post-transaction state and cannot move funds - that is their entire purpose.
 */
import { parseMessage } from "./message";
import { PROGRAM_ID } from "./pda";
import { COMPUTE_BUDGET_PROGRAM_ID } from "./message";

/** Phantom's transaction guard program, injected at signing time. */
export const LIGHTHOUSE_PROGRAM_ID = "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95";

export const ALLOWED_PROGRAMS = new Set([
  PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  LIGHTHOUSE_PROGRAM_ID,
]);

/** The three we relay, by discriminator. From chain/wavewarz.idl.json. */
export const RELAYABLE = {
  buyShares: "28ef8a9a08256a6c",
  sellShares: "b8a4a910e79ec7c4",
  claimShares: "82831ded86146ef5",
} as const;

export type RelayDecision =
  | { ok: true; trades: Array<keyof typeof RELAYABLE>; instructionCount: number }
  | { ok: false; reason: string };

const hex8 = (data: Uint8Array) => Buffer.from(data.slice(0, 8)).toString("hex");

/**
 * Decide on the serialized MESSAGE bytes, not the signed envelope - the caller
 * strips signatures first. Returns a reason rather than throwing: the route
 * turns this into a 4xx with the reason in the body, and a caller sending a
 * malformed transaction deserves to be told which rule it broke.
 */
export function decideRelay(messageBytes: Uint8Array): RelayDecision {
  let message;
  try {
    message = parseMessage(messageBytes);
  } catch (err) {
    return { ok: false, reason: `unparseable message: ${(err as Error).message}` };
  }

  if (message.instructions.length === 0) {
    return { ok: false, reason: "no instructions" };
  }

  const trades: Array<keyof typeof RELAYABLE> = [];
  for (const ix of message.instructions) {
    if (!ALLOWED_PROGRAMS.has(ix.programId)) {
      return { ok: false, reason: `program not allowed: ${ix.programId}` };
    }
    if (ix.programId !== PROGRAM_ID) continue;

    const disc = hex8(ix.data);
    const name = (Object.keys(RELAYABLE) as Array<keyof typeof RELAYABLE>).find(
      (k) => RELAYABLE[k] === disc,
    );
    if (!name) {
      return {
        ok: false,
        reason: `WaveWarZ instruction is not a relayable trade (discriminator ${disc})`,
      };
    }
    trades.push(name);
  }

  if (trades.length === 0) {
    return { ok: false, reason: "no WaveWarZ trade in this transaction" };
  }
  return { ok: true, trades, instructionCount: message.instructions.length };
}

/**
 * Split a serialized transaction into its signatures and its message.
 *
 * The signature count is a compact-u16, so a hostile caller can claim more
 * signatures than the buffer holds and walk the offset past the end. Checked
 * here rather than trusted, because everything downstream indexes from it.
 */
export function splitTransaction(tx: Uint8Array): {
  signatureCount: number;
  message: Uint8Array;
} {
  if (tx.length === 0) throw new Error("empty transaction");
  const count = tx[0];
  if (count === 0) throw new Error("transaction carries no signature");
  if (count > 16) throw new Error(`implausible signature count: ${count}`);
  const start = 1 + 64 * count;
  if (start >= tx.length) {
    throw new Error(`transaction claims ${count} signatures but is only ${tx.length} bytes`);
  }
  return { signatureCount: count, message: tx.slice(start) };
}
