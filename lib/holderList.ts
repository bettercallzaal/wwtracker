// The 20-account cap on Solana's getTokenLargestAccounts, and the one inference
// it quietly breaks.
//
// Split out of lib/battlePositions.ts rather than living beside the rest of the
// position logic, for a build reason worth stating: that module derives PDAs and
// so imports node:crypto, which cannot be pulled into a client bundle. The live
// page needs these two helpers on the client. Everything here is pure and has no
// imports, deliberately.

/**
 * `getTokenLargestAccounts` returns **at most 20 accounts**. That is an RPC
 * limit, not a property of the battle, and it arrives as a plain list with
 * nothing on it saying it was cut short.
 *
 * Measured against every battle in the platform's history - 1,643 battles,
 * 15,359 trades - the most holders any side has ever ended with is **18**, and
 * six battles have passed ten. So the cap has never actually been hit, which is
 * precisely why it is dangerous: the first event large enough to hit it will be
 * the first event anybody is watching this page during.
 */
export const LARGEST_ACCOUNTS_CAP = 20;

/**
 * Whether a holder list came back at the cap, and therefore might be short.
 *
 * Deliberately conservative: exactly 20 holders is indistinguishable from 20 of
 * 34, because the RPC returns the same thing either way. A side with genuinely
 * 20 holders is reported as possibly-truncated, which understates our knowledge
 * rather than overstating it.
 */
export function holderListTruncated(returned: number): boolean {
  return returned >= LARGEST_ACCOUNTS_CAP;
}

/**
 * The fraction of a side's supply that has been claimed and burned, or `null`
 * when that cannot be known.
 *
 * Supply above the sum of held balances means the difference was burned at
 * claim. That inference is only valid when the holder list is COMPLETE - if the
 * list is truncated, the "missing" supply is sitting in the holders the RPC did
 * not return, and reporting it as burned invents a settlement that never
 * happened.
 *
 * Returns null rather than 0 for the same reason the routes return `unknown`
 * rather than a zero-filled object: an unknown rendered as a number is a lie
 * that looks like data.
 */
export function burnedShare(
  supply: number,
  held: number,
  truncated: boolean,
): number | null {
  if (truncated) return null;
  if (supply <= 0) return null;
  if (held >= supply) return null;
  return (supply - held) / supply;
}
