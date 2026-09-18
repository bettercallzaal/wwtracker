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
 * `lib/__fixtures__`: six instructions, three of them Lighthouse.
 *
 * WHAT ACTUALLY MAKES THAT SAFE IS NOT LIGHTHOUSE'S BEHAVIOUR. The first version
 * of this comment defended the entry by saying Lighthouse only asserts and
 * cannot move funds. True of its documented instruction set, and the wrong
 * argument: it rests on a belief about somebody else's program.
 *
 * The property that holds regardless is structural. THE RELAY NEVER SIGNS. The
 * server has `SOLANA_RPC_URL` and no keypair; it forwards already-signed bytes
 * with `sigVerify: false`, and the fee payer is `accounts[0]`, which must have
 * signed. So the caller is the sole signer and the sole payer, and any funds a
 * smuggled instruction could move are the caller's own. That stays true even if
 * the belief about Lighthouse is wrong, which is what makes it the better
 * argument. (Non-author security review, 2026-09-17.)
 *
 * WHY THE ASSOCIATED TOKEN PROGRAM IS ALLOWED. A wallet's first trade in a
 * battle has to create its two token accounts first - the WaveWarZ program does
 * not do it, which cost a session an afternoon to establish (see
 * `instructions.ts`). So a first-time trader's transaction carries two
 * `ATokenGP...` instructions before the trade, and a policy without this entry
 * refuses every new trader while letting every returning one through. That is the
 * worst possible shape for a bug: it works for whoever tests it.
 *
 * The same structural argument covers it. The ATA program creates token accounts
 * and moves tokens between a nested account and its owner's; every lamport and
 * every token involved belongs to the sole signer, who is the caller. It cannot
 * reach ours, because we do not sign.
 *
 * THREE LIMITS OF THIS POLICY, all real, all bounded by the same property:
 *
 *   - Lighthouse is matched on PROGRAM ID ONLY. A Lighthouse instruction with
 *     arbitrary data and arbitrary accounts passes. Demonstrated by review.
 *   - The ATA program is matched on PROGRAM ID ONLY, for the same reason: every
 *     instruction it has spends the caller's own rent on the caller's own
 *     accounts, so enumerating its discriminators would buy nothing.
 *   - A trade is matched on DISCRIMINATOR ONLY. A buy naming an attacker-chosen
 *     battle, vault or recipient passes, because the accounts are never checked
 *     against the battle id they claim.
 *
 * Neither is fixed in code, deliberately: validating accounts here would mean
 * re-deriving PDAs per request and would still not stop a caller spending their
 * own money badly. They are written down because a future reader who assumes
 * this policy validates more than it does would be wrong.
 */
import { parseMessage } from "./message";
import { ASSOCIATED_TOKEN_PROGRAM_ID, PROGRAM_ID } from "./pda";
import { COMPUTE_BUDGET_PROGRAM_ID } from "./message";

/** Phantom's transaction guard program, injected at signing time. */
export const LIGHTHOUSE_PROGRAM_ID = "L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95";

export const ALLOWED_PROGRAMS = new Set([
  PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
  LIGHTHOUSE_PROGRAM_ID,
  // A first-time trader creates their two token accounts in the same
  // transaction. Without this, the relay serves returning traders only.
  ASSOCIATED_TOKEN_PROGRAM_ID,
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

/**
 * The first eight bytes as hex, without `Buffer`.
 *
 * `Buffer` is Node's, and Next polyfills it in the browser - so this file
 * worked everywhere while quietly being the only module in `lib/ww` that could
 * not run outside a bundler that patches globals. The whole stated purpose of
 * this directory is to be liftable onto somebody else's stack, and a dependency
 * on a polyfill is a dependency. Found 2026-09-18 while declaring the SDK's
 * public surface, which is the first thing that had a reason to look.
 */
const hex8 = (data: Uint8Array) =>
  Array.from(data.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Decide on the serialized MESSAGE bytes, not the signed envelope - the caller
 * strips signatures first. Returns a reason rather than throwing: the route
 * turns this into a 4xx with the reason in the body, and a caller sending a
 * malformed transaction deserves to be told which rule it broke.
 */
export function decideRelay(messageBytes: Uint8Array): RelayDecision {
  /**
   * Versioned (v0) transactions are refused BY DESIGN, not by accident.
   *
   * `parseMessage` is legacy-only: it resolves every program by indexing the
   * static account-keys array, which is exactly what a v0 address lookup table
   * defeats - in v0 a program can live in an ALT, and resolving it needs an
   * on-chain fetch an offline parser cannot make. So a crafted message could
   * parse cleanly here as all-allowed legacy while the runtime reads the same
   * bytes as v0 and executes instructions this policy never saw.
   *
   * A v0 message already failed, but only because the 0x80 version byte
   * happened to break compact-u16 alignment - "unparseable message", by luck.
   * Luck is not a defence and a future parser change could remove it. Supporting
   * v0 is not the answer either: ALTs cannot be resolved offline, so refusing is
   * correct. (Non-author security review, 2026-09-17.)
   */
  if (messageBytes.length > 0 && (messageBytes[0] & 0x80) !== 0) {
    return {
      ok: false,
      reason: "versioned transactions not supported - send a legacy transaction",
    };
  }

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
