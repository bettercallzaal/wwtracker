/**
 * What a wallet can claim, worked out from a live read rather than a list.
 *
 * THE SHAPE OF THIS IS A RULING, NOT A PREFERENCE. `recon/UNCLAIMED.md` in the
 * protocol repo killed the obvious build - a public page listing every wallet
 * with money waiting - for a reason that applies to anything in this area:
 * **the page going stale is the page working.** Everyone who reads such a list
 * and claims makes a row on it false, and the failure is telling somebody they
 * are owed money they have already taken. Measured drift: 1.76% in one quiet
 * day. What that note endorsed instead is a live per-wallet check - read the
 * wallet's holdings now, report what it can claim now, correct by construction.
 *
 * SO NOTHING HERE IS CACHED AND NOTHING HERE IS STORED. Every function takes
 * what a caller just read and derives from it. There is no balance cache, no
 * battle list, and no index held across requests. If a future change adds one,
 * read the note first.
 *
 * HOW A MINT BECOMES A BATTLE ID, WITHOUT A LOOKUP TABLE. PDA derivation runs
 * one way - battle id to mint - and a wallet's holdings come back as mints.
 * Building the reverse map for 1,545 battles measured at 1.36 seconds, which is
 * both slow and a thing that can go stale. The chain answers it directly
 * instead: a battle mint's `mintAuthority` IS the battle PDA, and the battle
 * account carries its own `battle_id` at offset 8. Verified against mainnet on
 * two battles, both exact.
 *
 * And the answer is then CHECKED rather than trusted. `verifyMintBelongsToBattle`
 * re-derives the mint from the recovered id and requires it to match. Without
 * that, any token whose mint authority happened to look like a battle account
 * would be accepted, and the claim instruction would be built against the wrong
 * battle - well-formed, and pointed at somebody else's vault.
 */
import { mintPda } from "./pda";

export interface BattleMint {
  battleId: number;
  side: "a" | "b";
}

/** One token account as an RPC returns it, narrowed to what this needs. */
export interface HeldToken {
  mint: string;
  /** Base units, as a string because a u64 does not fit a JS number safely. */
  amount: string;
}

export interface ClaimablePosition {
  battleId: number;
  side: "a" | "b";
  mint: string;
  /** Base units. String for the same reason as above. */
  amount: string;
  /** Lamports in the battle's vault, from a read. Never a stored figure. */
  vaultLamports: number;
}

/**
 * Read a battle id out of a raw battle account.
 *
 * Offset 8, immediately after the Anchor discriminator. Returns null rather
 * than throwing on a short buffer: a truncated or unrelated account is a normal
 * thing to encounter when following an arbitrary token's mint authority, not an
 * exceptional one.
 */
export function battleIdFromAccount(raw: Uint8Array): number | null {
  if (raw.length < 16) return null;
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const id = view.getBigUint64(8, true);
  // Battle ids are unix seconds. Anything outside a plausible range means the
  // account was not a battle, whatever its discriminator suggested.
  if (id < 1_600_000_000n || id > 2_600_000_000n) return null;
  return Number(id);
}

/**
 * Has the program actually ended this battle?
 *
 * Byte 245, the same offset `lib/battlePositions.ts` and `/api/ww/battle-account`
 * read. **This is NOT the same fact as the public API's `winnerDecided`**, and
 * the difference is not academic: battle 1787568630 reports `winnerDecided: true`
 * on wavewarz.info and simulating a claim against it returns
 * `BattleNotEnded (6009)`. The API records a judged result; the program records
 * whether `end_battle` has run and the vault can pay out.
 *
 * Measured 2026-09-18 while simulating real claims, which is the only reason the
 * distinction is here rather than discovered by somebody whose claim failed.
 */
export function battleIsSettled(raw: Uint8Array): boolean | null {
  if (raw.length < 246) return null;
  return raw[245] !== 0;
}

/**
 * Does this mint actually belong to this battle, on this side?
 *
 * The round trip is the whole check: derive the mint from the battle id and
 * require it to equal the mint we started from. An attacker-created token whose
 * mint authority is a real battle PDA fails here, because they cannot make the
 * derivation come out to a mint they control.
 */
export function verifyMintBelongsToBattle(
  mint: string,
  battleId: number,
): BattleMint | null {
  if (mintPda(battleId, "a") === mint) return { battleId, side: "a" };
  if (mintPda(battleId, "b") === mint) return { battleId, side: "b" };
  return null;
}

/**
 * Filter a wallet's holdings to non-zero balances.
 *
 * A zero balance is dropped rather than shown as a position worth nothing.
 * `claim_shares` BURNS the claimer's tokens, so a zero balance is the signature
 * of an already-claimed position, and rendering it as a row reading "0" invites
 * exactly the misreading the unclaimed note warned about.
 */
export function nonZeroHoldings(held: HeldToken[]): HeldToken[] {
  return held.filter((t) => {
    // Compare as BigInt: a u64 in base units exceeds Number.MAX_SAFE_INTEGER
    // for a large position, and string comparison on amounts is a trap.
    try {
      return BigInt(t.amount) > 0n;
    } catch {
      return false; // an unparseable amount is not evidence of a position
    }
  });
}

/**
 * The rent floor on a battle vault, in lamports.
 *
 * A fully claimed vault still holds this much, because an account below the
 * rent-exempt minimum is purged. So "the vault has lamports" does NOT mean
 * "there is something to claim", and treating it that way reports a drained
 * battle as payable. From `recon/UNCLAIMED.md`, which measured it.
 */
export const VAULT_RENT_FLOOR_LAMPORTS = 890_880;

/** Lamports in a vault above the floor, which is the part that can move. */
export function vaultPayableLamports(vaultLamports: number): number {
  return Math.max(0, vaultLamports - VAULT_RENT_FLOOR_LAMPORTS);
}

/**
 * Hold two facts together: the wallet holds tokens AND the vault has something
 * above the floor to pay out.
 *
 * Both are required. Tokens against a drained vault is a settled position whose
 * SOL has gone; a funded vault with no tokens is somebody else's money.
 * Reporting either as claimable is the "owed money they have already taken"
 * failure wearing a different hat.
 */
export function claimablePositions(
  positions: Array<BattleMint & { mint: string; amount: string }>,
  vaultLamportsByBattle: Map<number, number>,
  /**
   * Whether the PROGRAM has ended each battle. Omit a battle and it is treated
   * as unknown-and-excluded, never as settled - the same "unread is not empty"
   * contract as the vault map.
   */
  settledByBattle?: Map<number, boolean>,
): ClaimablePosition[] {
  const out: ClaimablePosition[] = [];
  for (const p of positions) {
    const vaultLamports = vaultLamportsByBattle.get(p.battleId);
    // Unread is not the same as empty. A vault we failed to read is omitted,
    // never rendered as zero - the same contract /api/ww/positions uses.
    if (vaultLamports === undefined) continue;
    if (vaultPayableLamports(vaultLamports) <= 0) continue;
    // An unsettled battle still holds its pool and the wallet still holds its
    // tokens, so both earlier checks pass and the program still refuses with
    // BattleNotEnded. Listing it as claimable would be a promise the chain
    // declines to keep.
    if (settledByBattle && settledByBattle.get(p.battleId) !== true) continue;
    out.push({ ...p, vaultLamports });
  }
  // Largest vault first: the order someone scanning the list would want.
  return out.sort((x, y) => y.vaultLamports - x.vaultLamports);
}

/**
 * The battles a claim covers, deduplicated.
 *
 * A wallet can hold BOTH sides of one battle - two token accounts, ONE claim.
 * `claimShares` takes no arguments and settles the whole position, so building
 * one instruction per token account would send the second against tokens the
 * first already burned.
 */
export function battlesToClaim(positions: ClaimablePosition[]): number[] {
  return [...new Set(positions.map((p) => p.battleId))];
}
