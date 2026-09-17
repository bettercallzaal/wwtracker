/**
 * Serializing a legacy transaction message, and reading one back.
 *
 * Still no dependencies - same reason as `instructions.ts`. A wallet signs the
 * bytes this produces; nothing here holds a key or talks to a network.
 *
 * WHAT IS VERIFIED AGAINST CHAIN, AND WHAT IS NOT - this distinction is the
 * point, so it is stated rather than implied. The real mainnet buy in
 * `__fixtures__/ww-buy-transaction-message.json` round-trips through `parseMessage`
 * and `serializeMessage` byte for byte, which proves the ENCODING: compact-u16,
 * the header arithmetic, account indices, the field order. It does NOT prove that
 * `serializeMessage` orders accounts the way that transaction's client ordered
 * them, because it does not, and it does not need to.
 *
 * Solana has no canonical account order. The header declares how many accounts
 * are writable signers, readonly signers and readonly non-signers, and every
 * instruction addresses accounts by index, so any order whose header and indices
 * agree is a valid message. The fixture's own order is not even sortable - its
 * writable accounts happen to be in base58 order and its readonly ones are not -
 * because that is whatever its client library did. Matching it would be
 * imitating an implementation detail and calling it correctness.
 *
 * Also worth knowing before reading the fixture: only one of its six instructions
 * is ours. Two are ComputeBudget (a unit limit and a priority fee) and three are
 * Lighthouse (`L2TExMF...`), the guard program Phantom injects at signing time to
 * assert the transaction did what it said. A builder that tried to reproduce all
 * six would be reproducing the wallet's work.
 */

import { b58decode, b58encode } from "./pda";
import type { AccountMeta, Instruction } from "./instructions";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

/** Solana's compact-u16: 7 bits per byte, high bit continues. */
export function encodeCompactU16(n: number): Uint8Array {
  if (n < 0 || n > 0xffff) throw new Error(`compact-u16 out of range: ${n}`);
  const out: number[] = [];
  let rest = n;
  for (;;) {
    const chunk = rest & 0x7f;
    rest >>= 7;
    if (rest === 0) {
      out.push(chunk);
      break;
    }
    out.push(chunk | 0x80);
  }
  return Uint8Array.from(out);
}

/**
 * Reading past the end must throw, not return a plausible number. `bytes[i]` on
 * a truncated buffer is `undefined`, and `undefined & 0x7f` is 0 - so without
 * this check the loop terminates cleanly and yields a wrong length, which the
 * caller then trusts. A module whose purpose is showing someone what they are
 * about to sign cannot fail that way on malformed input.
 */
export function decodeCompactU16(bytes: Uint8Array, at: number): [number, number] {
  let n = 0;
  let shift = 0;
  let i = at;
  for (;;) {
    if (i >= bytes.length) {
      throw new Error(`compact-u16 ran past the end of the buffer at byte ${i}`);
    }
    const c = bytes[i++];
    n |= (c & 0x7f) << shift;
    if ((c & 0x80) === 0) break;
    shift += 7;
    if (shift > 14) throw new Error("compact-u16 longer than three bytes");
  }
  return [n, i];
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export interface CompiledAccount {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
}

export interface Message {
  payer: string;
  recentBlockhash: string;
  accounts: CompiledAccount[];
  instructions: Instruction[];
}

const b58less = (a: string, b: string): number => {
  // Compare in base58 alphabet order, not JS string order - they differ, because
  // the alphabet is not ASCII-ordered.
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const d = ALPHABET.indexOf(a[i]) - ALPHABET.indexOf(b[i]);
    if (d !== 0) return d;
  }
  return a.length - b.length;
};

/**
 * Collect every account the instructions touch, plus each program id, merge
 * duplicates by taking the strongest flags, and put them in the four groups the
 * header describes. The payer is forced first, which the runtime requires: it is
 * the fee payer and the first signature.
 *
 * Within a group the order is by base58, purely so the output is deterministic.
 * Any order is valid; a deterministic one makes a diff mean something.
 */
export function compileAccounts(
  payer: string,
  instructions: Instruction[],
): CompiledAccount[] {
  const merged = new Map<string, CompiledAccount>();
  // The merge takes the STRONGEST flags, never the latest: an account that is
  // writable in one instruction and readonly in another must end up writable, or
  // the instruction that writes it fails at runtime. Every real WaveWarZ
  // instruction is flag-consistent per account, so this branch only ever runs in
  // the trivial case and no fixture can exercise it - see the synthetic
  // conflicting-flags test, which is the only way that case exists here.
  const see = (m: CompiledAccount) => {
    const prev = merged.get(m.pubkey);
    if (prev) {
      prev.isSigner ||= m.isSigner;
      prev.isWritable ||= m.isWritable;
    } else {
      merged.set(m.pubkey, { ...m });
    }
  };

  see({ pubkey: payer, isSigner: true, isWritable: true });
  for (const ix of instructions) for (const k of ix.keys) see(k);
  // A program id is invoked, never written or signed - but if the same address
  // also appears as a regular account, the stronger flags already won above.
  for (const ix of instructions) see({ pubkey: ix.programId, isSigner: false, isWritable: false });

  const all = [...merged.values()].filter((a) => a.pubkey !== payer);
  const group = (signer: boolean, writable: boolean) =>
    all.filter((a) => a.isSigner === signer && a.isWritable === writable).sort((x, y) => b58less(x.pubkey, y.pubkey));

  return [
    merged.get(payer)!,
    ...group(true, true),
    ...group(true, false),
    ...group(false, true),
    ...group(false, false),
  ];
}

export function serializeMessage(
  payer: string,
  recentBlockhash: string,
  instructions: Instruction[],
): Uint8Array {
  const accounts = compileAccounts(payer, instructions);
  const index = new Map(accounts.map((a, i) => [a.pubkey, i]));

  const numSigners = accounts.filter((a) => a.isSigner).length;
  const numReadonlySigned = accounts.filter((a) => a.isSigner && !a.isWritable).length;
  const numReadonlyUnsigned = accounts.filter((a) => !a.isSigner && !a.isWritable).length;

  const body: Uint8Array[] = [
    Uint8Array.from([numSigners, numReadonlySigned, numReadonlyUnsigned]),
    encodeCompactU16(accounts.length),
    ...accounts.map((a) => b58decode(a.pubkey)),
    b58decode(recentBlockhash),
    encodeCompactU16(instructions.length),
  ];

  for (const ix of instructions) {
    const programIndex = index.get(ix.programId);
    if (programIndex === undefined) throw new Error(`program not compiled: ${ix.programId}`);
    body.push(Uint8Array.from([programIndex]));
    body.push(encodeCompactU16(ix.keys.length));
    body.push(
      Uint8Array.from(
        ix.keys.map((k) => {
          const i = index.get(k.pubkey);
          if (i === undefined) throw new Error(`account not compiled: ${k.pubkey}`);
          return i;
        }),
      ),
    );
    body.push(encodeCompactU16(ix.data.length));
    body.push(ix.data);
  }

  return concat(body);
}

/**
 * Read a serialized message back. Used by the round-trip control, and worth
 * having on its own: a widget that moves money should be able to show what it is
 * about to ask a wallet to sign, rather than asking the person to trust it.
 */
export function parseMessage(bytes: Uint8Array): Message {
  const [numSigners, numReadonlySigned, numReadonlyUnsigned] = bytes;
  let at = 3;
  let numKeys: number;
  [numKeys, at] = decodeCompactU16(bytes, at);

  const keys: string[] = [];
  for (let i = 0; i < numKeys; i++) {
    keys.push(b58encode(bytes.slice(at, at + 32)));
    at += 32;
  }
  const recentBlockhash = b58encode(bytes.slice(at, at + 32));
  at += 32;

  const accounts: CompiledAccount[] = keys.map((pubkey, i) => ({
    pubkey,
    isSigner: i < numSigners,
    isWritable:
      i < numSigners - numReadonlySigned ||
      (i >= numSigners && i < numKeys - numReadonlyUnsigned),
  }));

  let numIx: number;
  [numIx, at] = decodeCompactU16(bytes, at);
  const instructions: Instruction[] = [];
  for (let i = 0; i < numIx; i++) {
    const programId = keys[bytes[at++]];
    let numAccounts: number;
    [numAccounts, at] = decodeCompactU16(bytes, at);
    const ixKeys: AccountMeta[] = [];
    for (let k = 0; k < numAccounts; k++) ixKeys.push({ ...accounts[bytes[at++]] });
    let dataLen: number;
    [dataLen, at] = decodeCompactU16(bytes, at);
    instructions.push({ programId, keys: ixKeys, data: bytes.slice(at, at + dataLen) });
    at += dataLen;
  }

  if (at !== bytes.length) {
    throw new Error(`message had ${bytes.length - at} trailing bytes`);
  }
  return { payer: keys[0], recentBlockhash, accounts, instructions };
}

/** Re-serialize a parsed message without recompiling - preserves its own order. */
export function reserializeMessage(m: Message): Uint8Array {
  const index = new Map(m.accounts.map((a, i) => [a.pubkey, i]));
  const numSigners = m.accounts.filter((a) => a.isSigner).length;
  const numReadonlySigned = m.accounts.filter((a) => a.isSigner && !a.isWritable).length;
  const numReadonlyUnsigned = m.accounts.filter((a) => !a.isSigner && !a.isWritable).length;

  const body: Uint8Array[] = [
    Uint8Array.from([numSigners, numReadonlySigned, numReadonlyUnsigned]),
    encodeCompactU16(m.accounts.length),
    ...m.accounts.map((a) => b58decode(a.pubkey)),
    b58decode(m.recentBlockhash),
    encodeCompactU16(m.instructions.length),
  ];
  for (const ix of m.instructions) {
    body.push(Uint8Array.from([index.get(ix.programId)!]));
    body.push(encodeCompactU16(ix.keys.length));
    body.push(Uint8Array.from(ix.keys.map((k) => index.get(k.pubkey)!)));
    body.push(encodeCompactU16(ix.data.length));
    body.push(ix.data);
  }
  return concat(body);
}

/**
 * Cap the compute units a transaction may use. Lower than the 200k default costs
 * less at a given priority fee; too low and the program runs out mid-execution.
 */
export function computeUnitLimitInstruction(units: number): Instruction {
  const data = new Uint8Array(5);
  data[0] = 2;
  new DataView(data.buffer).setUint32(1, units, true);
  return { programId: COMPUTE_BUDGET_PROGRAM_ID, keys: [], data };
}

/**
 * The priority fee, in micro-lamports per compute unit. The fee is this times
 * the unit limit, divided by a million: the fixture's 200,000 units at 375,000
 * micro-lamports is 75,000 lamports, 0.000075 SOL. Which is why the two are set
 * together - the price alone says nothing about what will be paid.
 */
export function computeUnitPriceInstruction(microLamports: bigint | number): Instruction {
  const data = new Uint8Array(9);
  data[0] = 3;
  new DataView(data.buffer).setBigUint64(1, BigInt(microLamports), true);
  return { programId: COMPUTE_BUDGET_PROGRAM_ID, keys: [], data };
}
