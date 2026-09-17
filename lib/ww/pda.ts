/**
 * Base58, and the four program-derived addresses a WaveWarZ battle uses.
 *
 * Dependency-free on purpose. Zaal's 2026-09-13 ruling puts the widget in
 * wwtracker first and on wavewarz.info after, with Candy implementing it on her
 * stack - so anything that reaches for this repo's internals, or for a library
 * her stack does not have, is a thing she cannot use. A module that takes a
 * battle id and returns bytes is portable; one that takes a web3.js Connection
 * is not.
 *
 * Ported from tools/wwchain.py in wavewarz-protocol, which derived these against
 * mainnet for all 1,679 battles. The port is checked against a real on-chain
 * transaction rather than against the Python - see __tests__/wwInstructions.test.ts.
 */
import { sha256 } from "./sha256";

// NOT node:crypto. That is Node-only, so it breaks the moment a bundler is asked
// to put this in a browser - which is exactly what happened the first time the
// widget was built, and which no test in this repo could have caught because
// vitest runs in Node. See lib/ww/sha256.ts.

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function b58encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = "";
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of bytes) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

export function b58decode(s: string): Uint8Array {
  let n = 0n;
  for (const c of s) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error(`not base58: ${JSON.stringify(c)}`);
    n = n * 58n + BigInt(i);
  }
  const body: number[] = [];
  while (n > 0n) {
    body.unshift(Number(n % 256n));
    n /= 256n;
  }
  let leading = 0;
  for (const c of s) {
    if (c !== "1") break;
    leading++;
  }
  return Uint8Array.from([...new Array(leading).fill(0), ...body]);
}

// ed25519 field and curve constant, for the on-curve test that PDA derivation
// inverts: a program-derived address is precisely a hash that is NOT a valid
// public key, which is why no private key can exist for it.
const P = (1n << 255n) - 19n;
const D =
  37095705934669439343138083508754565189542113879843219016388785533085940283555n;

function powmod(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function onCurve(bytes: Uint8Array): boolean {
  let y = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) y = y * 256n + BigInt(bytes[i]);
  y &= (1n << 255n) - 1n;
  const y2 = (y * y) % P;
  const x2 = (((y2 - 1n) * powmod((D * y2 + 1n) % P, P - 2n, P)) % P + P) % P;
  if (x2 === 0n) return false;
  return powmod(x2, (P - 1n) / 2n, P) === 1n;
}

/** `chain/wavewarz.idl.json`'s own `address`, and PROGRAM in tools/wwchain.py. */
export const PROGRAM_ID = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ASSOCIATED_TOKEN_PROGRAM_ID =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

const MARKER = new TextEncoder().encode("ProgramDerivedAddress");

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Seeds, then bump, then program id, then the marker. The order is load-bearing. */
export function findPda(
  seeds: Uint8Array[],
  programId: string = PROGRAM_ID,
): { address: string; bump: number } {
  const prog = b58decode(programId);
  for (let bump = 255; bump >= 0; bump--) {
    const bytes = sha256(concat([...seeds, Uint8Array.from([bump]), prog, MARKER]));
    if (!onCurve(bytes)) return { address: b58encode(bytes), bump };
  }
  throw new Error("no off-curve address found");
}

export function u64le(value: bigint | number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value), true);
  return out;
}

export function i64le(value: bigint | number): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, BigInt(value), true);
  return out;
}

const seed = (s: string) => new TextEncoder().encode(s);

export const battlePda = (battleId: bigint | number) =>
  findPda([seed("battle"), u64le(battleId)]).address;

export const vaultPda = (battleId: bigint | number) =>
  findPda([seed("battle_vault"), u64le(battleId)]).address;

export const mintPda = (battleId: bigint | number, side: "a" | "b") =>
  findPda([seed(side === "a" ? "artist_a_mint" : "artist_b_mint"), u64le(battleId)])
    .address;

/** The trader's associated token account for one side's mint. */
export const associatedTokenAddress = (owner: string, mint: string) =>
  findPda(
    [b58decode(owner), b58decode(TOKEN_PROGRAM_ID), b58decode(mint)],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  ).address;
