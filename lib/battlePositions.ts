// Who holds what, on which side, during a battle.
//
// The two artist-side token mints are PDAs derived from the battle id, so the
// holder set is readable by anyone with a public Solana RPC while the battle is
// running. Nothing here needs the program's IDL, the indexer, or a key.
//
// Positions are NOT lost when a battle settles. The token accounts empty when
// traders claim, but every buy and sell is permanent in the vault's transaction
// history, so holdings at any moment are a replay rather than a snapshot that
// had to be captured live.
//
// Derivation and layout come from bettercallzaal/wavewarz-protocol, where each
// claim carries the sample it was measured on. The seed order below is
// load-bearing: seeds, then bump, then program id, then the marker. Get it wrong
// and you still get a well-formed, off-curve, entirely valid-looking address
// that is simply not the account, and getAccountInfo returns null with no error.

// The base58 and PDA primitives moved to lib/ww/pda.ts, which the trading
// widget also needs and which must stay dependency-free to be portable to
// Candy's stack. This file had its own copy of all of it - two implementations
// of ed25519 curve membership in one repo is one more than anyone wants to keep
// correct. Proved equivalent before removing: 53 comparisons across six battle
// ids and every account in the buy fixture, zero mismatches.
export {
  PROGRAM_ID,
  TOKEN_PROGRAM_ID as TOKEN_PROGRAM,
  b58encode,
  b58decode,
  findPda,
  battlePda,
  vaultPda,
  mintPda,
} from "./ww/pda";

import { b58encode, battlePda, mintPda } from "./ww/pda";


/**
 * The Battle account, 353 bytes. Offsets verified across all 1,643 accounts on
 * mainnet - see chain/BATTLE-ACCOUNT.md in the protocol repo.
 *
 * Two that mislead if taken at face value:
 *   - `winnerArtistA` at 244 is the MARKET winner. It equals the larger pool on
 *     every settled battle. The battle's actual result is judged off chain.
 *   - `totalDistribution` at 249 is the winner-side leg only, not the whole
 *     settlement.
 */
export interface BattleAccount {
  battleId: number;
  startTime: number;
  endTime: number;
  artistAWallet: string;
  artistBWallet: string;
  supplyA: number;
  supplyB: number;
  poolASol: number;
  poolBSol: number;
  /** Market winner: the larger pool. Not the judged result. */
  winnerArtistA: boolean;
  settled: boolean;
  totalDistributionSol: number;
  /** The launching wallet, at byte 257. */
  creator: string;
}

export function decodeBattle(raw: Uint8Array): BattleAccount {
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const u64 = (o: number) => Number(dv.getBigUint64(o, true));
  const i64 = (o: number) => Number(dv.getBigInt64(o, true));
  const pk = (o: number) => b58encode(raw.slice(o, o + 32));
  return {
    battleId: u64(8),
    startTime: i64(20),
    endTime: i64(28),
    artistAWallet: pk(36),
    artistBWallet: pk(68),
    supplyA: u64(196),
    supplyB: u64(204),
    poolASol: u64(212) / 1e9,
    poolBSol: u64(220) / 1e9,
    winnerArtistA: raw[244] !== 0,
    settled: raw[245] !== 0,
    totalDistributionSol: u64(249) / 1e9,
    creator: pk(257),
  };
}

export interface Holder {
  owner: string;
  amount: number;
  /** Share of that side's supply, 0-1. */
  share: number;
  /** That share expressed in SOL of the side's pool. */
  sol: number;
}

/** Rank holders and attach each one's share of the side's pool. */
export function rankHolders(
  raw: { owner: string; amount: number }[],
  supply: number,
  poolSol: number,
): Holder[] {
  return raw
    .filter((h) => h.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((h) => {
      const share = supply > 0 ? h.amount / supply : 0;
      return { owner: h.owner, amount: h.amount, share, sol: share * poolSol };
    });
}

/**
 * What the winning side shares if it wins, using the settlement formula measured
 * across 1,506 of 1,506 settled battles: winners take their own pool plus 40% of
 * the losing pool. Equal pools are the exception - the whole pot is returned.
 */
export function impliedWinnerPot(winnerPoolSol: number, loserPoolSol: number): number {
  if (winnerPoolSol === loserPoolSol) return winnerPoolSol + loserPoolSol;
  return winnerPoolSol + 0.4 * loserPoolSol;
}

/** Multiple on a holder's stake if their side wins. */
export function impliedMultiple(winnerPoolSol: number, loserPoolSol: number): number {
  if (winnerPoolSol <= 0) return 0;
  return impliedWinnerPot(winnerPoolSol, loserPoolSol) / winnerPoolSol;
}

export { LARGEST_ACCOUNTS_CAP, holderListTruncated, burnedShare } from "./holderList";
