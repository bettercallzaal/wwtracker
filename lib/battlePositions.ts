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

import { createHash } from "node:crypto";

export const PROGRAM_ID = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function b58encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = "";
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  let leading = 0;
  for (const b of bytes) {
    if (b !== 0) break;
    leading++;
  }
  return "1".repeat(leading) + s;
}

export function b58decode(str: string): Uint8Array {
  let n = 0n;
  for (const c of str) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error(`not base58: ${c}`);
    n = n * 58n + BigInt(i);
  }
  const out: number[] = [];
  while (n > 0n) {
    out.unshift(Number(n % 256n));
    n /= 256n;
  }
  let leading = 0;
  for (const c of str) {
    if (c !== "1") break;
    leading++;
  }
  return Uint8Array.from([...new Array(leading).fill(0), ...out]);
}

// ed25519 curve membership, so we reject on-curve candidates exactly as Solana
// does. A PDA is by definition an address with no private key, which means it
// must be off the curve.
const P = 2n ** 255n - 19n;

function modpow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

const D = (-121665n * modpow(121666n, P - 2n, P)) % P;

export function isOnCurve(bytes: Uint8Array): boolean {
  let y = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) y = y * 256n + BigInt(bytes[i]);
  y &= (1n << 255n) - 1n;
  const y2 = (y * y) % P;
  const denom = (((D * y2) % P) + 1n) % P;
  const x2 = ((((y2 - 1n) % P) + P) % P * modpow(denom, P - 2n, P)) % P;
  if (x2 === 0n) return false;
  return modpow(x2, (P - 1n) / 2n, P) === 1n;
}

function u64le(n: number | bigint): Uint8Array {
  let v = BigInt(n);
  const out = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** seeds, then bump, then program id, then the marker. The order is the trap. */
export function findPda(seeds: Uint8Array[], programId = PROGRAM_ID): { address: string; bump: number } {
  const prog = b58decode(programId);
  const marker = new TextEncoder().encode("ProgramDerivedAddress");
  for (let bump = 255; bump >= 0; bump--) {
    const h = createHash("sha256");
    for (const s of seeds) h.update(s);
    h.update(Uint8Array.from([bump]));
    h.update(prog);
    h.update(marker);
    const digest = new Uint8Array(h.digest());
    if (!isOnCurve(digest)) return { address: b58encode(digest), bump };
  }
  throw new Error("no off-curve address found");
}

const enc = (s: string) => new TextEncoder().encode(s);

export const battlePda = (id: number) => findPda([enc("battle"), u64le(id)]).address;
export const vaultPda = (id: number) => findPda([enc("battle_vault"), u64le(id)]).address;
export const mintPda = (id: number, side: "a" | "b") =>
  findPda([enc(side === "a" ? "artist_a_mint" : "artist_b_mint"), u64le(id)]).address;

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
