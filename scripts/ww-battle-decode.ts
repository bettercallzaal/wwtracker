#!/usr/bin/env tsx
// Decode a WaveWarZ battle account from Helius RPC.
//
// Usage:
//   HELIUS_API_KEY=<key> npx tsx scripts/ww-battle-decode.ts <battle_id>
//   npx tsx scripts/ww-battle-decode.ts <battle_id>   # dry-run: shows PDA + curl command
//
// battle_id: the platform's battle id, as it appears in public/ww-battles.json -
// a large number like 1787629692, NOT a 0-based index. Small integers derive
// well-formed PDAs that simply do not exist.
//
// Without HELIUS_API_KEY: prints PDA + curl command (drop the key in and it works).
// With HELIUS_API_KEY: fetches live account data and decodes the Battle struct.
//
// Account layout source: docs/WAVEWARZ-RESEARCH.md section 3. Not the full IDL -
// struct field ORDER is still estimated from Anchor convention and may need
// adjustment if the private IDL diverges.
//
// What IS verified on chain, 2026-09-05, against api.mainnet-beta.solana.com:
//   battle 1787629692 -> FHAWa3GvcfEUg5Nnt3U17q9ijnXZg5CVUTbsPK11bdsA
//   battle 1787628392 -> 4g8wHQa9xkQ8M9HpN4RXrk6cB3NN1QgJJ4f2mBtL1Jrv
// Both exist and are owned by the program. The account is 353 bytes and its
// first 8 bytes equal sha256("account:Battle")[..8], so the discriminator and
// the account name are confirmed; only the field order below is inference.

import { createHash } from "node:crypto";
import { PROGRAM_ID } from "../lib/config";

const HELIUS_RPC = "https://mainnet.helius-rpc.com";

// --- Base58 codec (Bitcoin/Solana alphabet) ---------------------------------

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const B58_MAP = new Uint8Array(256).fill(255);
for (let i = 0; i < B58_ALPHABET.length; i++) B58_MAP[B58_ALPHABET.charCodeAt(i)] = i;

function base58Decode(s: string): Buffer {
  const digits = [0];
  for (let i = 0; i < s.length; i++) {
    const v = B58_MAP[s.charCodeAt(i)];
    if (v === 255) throw new Error(`Invalid base58 char: ${s[i]}`);
    let carry = v;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] * 58;
      digits[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { digits.push(carry & 0xff); carry >>= 8; }
  }
  // handle leading '1's (zero bytes)
  let zeros = 0;
  while (zeros < s.length && s[zeros] === "1") zeros++;
  const result = Buffer.alloc(zeros + digits.length);
  for (let i = 0; i < digits.length; i++) result[zeros + i] = digits[digits.length - 1 - i];
  return result;
}

function base58Encode(buf: Buffer): string {
  const digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) { digits.push(carry % 58); carry = Math.floor(carry / 58); }
  }
  let result = "";
  for (let i = 0; i < buf.length && buf[i] === 0; i++) result += "1";
  for (let i = digits.length - 1; i >= 0; i--) result += B58_ALPHABET[digits[i]];
  return result;
}

// --- ed25519 point check (needed to derive PDAs) ----------------------------
// A PDA hash must NOT be on the ed25519 curve.

const P = (1n << 255n) - 19n;
const D_NUM = -121665n;
const D_DEN = 121666n;

function modP(a: bigint): bigint { return ((a % P) + P) % P; }
function mulP(a: bigint, b: bigint): bigint { return modP(a * b); }
function powP(base: bigint, exp: bigint): bigint {
  let result = 1n; base = modP(base);
  while (exp > 0n) {
    if (exp & 1n) result = mulP(result, base);
    exp >>= 1n; base = mulP(base, base);
  }
  return result;
}
function invP(a: bigint): bigint { return powP(a, P - 2n); }

const D = mulP(D_NUM, invP(D_DEN));

function isOnEd25519Curve(bytes: Buffer): boolean {
  const b = Buffer.from(bytes);
  b[31] &= 0x7f; // clear the sign bit to get raw y
  // interpret as little-endian big integer
  let y = 0n;
  for (let i = b.length - 1; i >= 0; i--) y = (y << 8n) | BigInt(b[i]);
  if (y >= P) return false;
  const y2 = mulP(y, y);
  const u = modP(y2 - 1n);          // numerator of x^2
  const v = modP(mulP(D, y2) + 1n); // denominator of x^2
  const x2 = mulP(u, invP(v));
  if (x2 === 0n) return false;
  // Euler criterion: x2 is a QR mod P iff x2^((P-1)/2) === 1
  return powP(x2, (P - 1n) / 2n) === 1n;
}

// --- PDA derivation ---------------------------------------------------------

function findProgramAddress(seeds: Buffer[]): { address: Buffer; nonce: number } {
  const programBytes = base58Decode(PROGRAM_ID);
  const marker = Buffer.from("ProgramDerivedAddress");
  for (let nonce = 255; nonce >= 0; nonce--) {
    const h = createHash("sha256");
    for (const seed of seeds) h.update(seed);
    // Order is load-bearing and is NOT seeds/program/bump. Solana hashes
    // seeds, then the bump as a final seed, then the program id, then the
    // marker (see Pubkey::create_program_address, where find_program_address
    // pushes the bump onto the seed list before calling it). Putting the
    // program id ahead of the bump yields a well-formed off-curve address that
    // simply is not the account - it looks right and resolves to nothing.
    h.update(Buffer.from([nonce]));
    h.update(programBytes);
    h.update(marker);
    const candidate = h.digest();
    if (!isOnEd25519Curve(candidate)) {
      return { address: candidate, nonce };
    }
  }
  throw new Error("PDA not found (all nonces exhausted)");
}

function battlePDA(battleId: number): string {
  const idLE = Buffer.alloc(8);
  idLE.writeBigUInt64LE(BigInt(battleId));
  const { address } = findProgramAddress([Buffer.from("battle"), idLE]);
  return base58Encode(address);
}

function vaultPDA(battleId: number): string {
  const idLE = Buffer.alloc(8);
  idLE.writeBigUInt64LE(BigInt(battleId));
  const { address } = findProgramAddress([Buffer.from("battle_vault"), idLE]);
  return base58Encode(address);
}

// --- Battle struct parser ---------------------------------------------------
// Field order based on WAVEWARZ-RESEARCH.md §3 + standard Anchor convention.
// ESTIMATED — verify against IDL once the private repo is accessible.
//
// Anchor account prefix: 8-byte discriminator
// Fields (all LE):
//   u64    battle_id              (8 bytes)
//   i64    start_time             (8 bytes, unix seconds)
//   i64    end_time               (8 bytes, unix seconds)
//   Pubkey artist_a               (32 bytes)
//   Pubkey artist_b               (32 bytes)
//   Pubkey wavewarz_wallet        (32 bytes)
//   Pubkey artist_a_mint          (32 bytes)
//   Pubkey artist_b_mint          (32 bytes)
//   u64    artist_a_supply        (8 bytes, tokens)
//   u64    artist_b_supply        (8 bytes, tokens)
//   u64    artist_a_pool          (8 bytes, lamports)
//   u64    artist_b_pool          (8 bytes, lamports)
//   bool   winner_is_a            (1 byte)
//   bool   settled                (1 byte)
//   u64    total_distribution     (8 bytes, lamports)
//   Pubkey admin                  (32 bytes)

interface BattleState {
  discriminator: string;
  battleId: number;
  startTime: Date;
  endTime: Date;
  artistA: string;
  artistB: string;
  waveWarzWallet: string;
  mintA: string;
  mintB: string;
  supplyA: bigint;
  supplyB: bigint;
  poolA_SOL: number;
  poolB_SOL: number;
  winnerIsA: boolean;
  settled: boolean;
  totalDistribution_SOL: number;
  admin: string;
}

function parseBattleAccount(data: Buffer): BattleState {
  let offset = 0;

  const discriminator = data.subarray(0, 8).toString("hex");
  offset += 8;

  const battleId = Number(data.readBigUInt64LE(offset)); offset += 8;
  const startTime = new Date(Number(data.readBigInt64LE(offset)) * 1000); offset += 8;
  const endTime = new Date(Number(data.readBigInt64LE(offset)) * 1000); offset += 8;

  const readPubkey = () => { const v = base58Encode(data.subarray(offset, offset + 32)); offset += 32; return v; };

  const artistA = readPubkey();
  const artistB = readPubkey();
  const waveWarzWallet = readPubkey();
  const mintA = readPubkey();
  const mintB = readPubkey();

  const supplyA = data.readBigUInt64LE(offset); offset += 8;
  const supplyB = data.readBigUInt64LE(offset); offset += 8;
  const poolA_SOL = Number(data.readBigUInt64LE(offset)) / 1e9; offset += 8;
  const poolB_SOL = Number(data.readBigUInt64LE(offset)) / 1e9; offset += 8;

  const winnerIsA = data[offset] !== 0; offset += 1;
  const settled = data[offset] !== 0; offset += 1;

  const totalDistribution_SOL = Number(data.readBigUInt64LE(offset)) / 1e9; offset += 8;
  const admin = readPubkey();

  return { discriminator, battleId, startTime, endTime, artistA, artistB, waveWarzWallet, mintA, mintB, supplyA, supplyB, poolA_SOL, poolB_SOL, winnerIsA, settled, totalDistribution_SOL, admin };
}

function printBattleState(s: BattleState, battleId: number) {
  console.log(`\n=== BATTLE #${battleId} ===`);
  console.log(`  Discriminator:     ${s.discriminator}`);
  console.log(`  Battle ID:         ${s.battleId}`);
  console.log(`  Start:             ${s.startTime.toISOString()}`);
  console.log(`  End:               ${s.endTime.toISOString()}`);
  console.log(`  Artist A wallet:   ${s.artistA}`);
  console.log(`  Artist B wallet:   ${s.artistB}`);
  console.log(`  WaveWarZ wallet:   ${s.waveWarzWallet}`);
  console.log(`  Mint A:            ${s.mintA}`);
  console.log(`  Mint B:            ${s.mintB}`);
  console.log(`  Supply A:          ${s.supplyA}`);
  console.log(`  Supply B:          ${s.supplyB}`);
  console.log(`  Pool A:            ${s.poolA_SOL.toFixed(6)} SOL`);
  console.log(`  Pool B:            ${s.poolB_SOL.toFixed(6)} SOL`);
  console.log(`  Total vol:         ${(s.poolA_SOL + s.poolB_SOL).toFixed(6)} SOL`);
  console.log(`  Settled:           ${s.settled}`);
  console.log(`  Winner:            ${s.settled ? (s.winnerIsA ? "Artist A" : "Artist B") : "pending"}`);
  console.log(`  Total distributed: ${s.totalDistribution_SOL.toFixed(6)} SOL`);
  console.log(`  Admin:             ${s.admin}`);
}

// --- Main ------------------------------------------------------------------

async function main() {
  const battleIdArg = process.argv[2];
  if (!battleIdArg || isNaN(Number(battleIdArg))) {
    console.error("Usage: npx tsx scripts/ww-battle-decode.ts <battle_id>");
    console.error("  battle_id: numeric on-chain ID (0-based)");
    console.error("  HELIUS_API_KEY env var: if set, fetches live data; otherwise dry-run.");
    process.exit(1);
  }

  const battleId = Number(battleIdArg);
  const apiKey = process.env.HELIUS_API_KEY || "";

  console.log(`\nWaveWarZ Battle Decoder`);
  console.log(`  Battle ID:   ${battleId}`);

  let pda: string, vault: string;
  try {
    pda = battlePDA(battleId);
    vault = vaultPDA(battleId);
  } catch (e) {
    console.error(`PDA derivation failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }

  console.log(`  Battle PDA:  ${pda}`);
  console.log(`  Vault PDA:   ${vault}`);
  console.log(`  Program:     ${PROGRAM_ID}`);

  const rpcUrl = apiKey ? `${HELIUS_RPC}/?api-key=${apiKey}` : `${HELIUS_RPC}/?api-key=<YOUR_KEY>`;
  const payload = JSON.stringify({
    jsonrpc: "2.0", id: 1,
    method: "getAccountInfo",
    params: [pda, { encoding: "base64" }],
  }, null, 2);

  if (!apiKey) {
    console.log("\n--- DRY RUN (no HELIUS_API_KEY set) ---");
    console.log("Set HELIUS_API_KEY and re-run, or paste this curl command:\n");
    console.log(`curl -s -X POST '${HELIUS_RPC}/?api-key=<YOUR_KEY>' \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -d '${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [pda, { encoding: "base64" }] })}'`);
    console.log("\nVault PDA curl:");
    console.log(`curl -s -X POST '${HELIUS_RPC}/?api-key=<YOUR_KEY>' \\`);
    console.log(`  -H 'Content-Type: application/json' \\`);
    console.log(`  -d '${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [vault, { encoding: "base64" }] })}'`);
    console.log("\n[set HELIUS_API_KEY to decode live on-chain state]");
    return;
  }

  console.log("\nFetching battle account from Helius...");
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!resp.ok) throw new Error(`Helius RPC returned ${resp.status}`);
  const json = await resp.json() as { result?: { value?: { data?: [string, string] } }; error?: { message: string } };

  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  const value = json.result?.value;
  if (!value) {
    console.log(`\nAccount not found at PDA ${pda}`);
    console.log("  → Battle may not exist for this ID, or PDA derivation order is wrong.");
    return;
  }

  const [dataB64] = value.data as [string, string];
  const data = Buffer.from(dataB64, "base64");
  console.log(`  Raw account: ${data.length} bytes`);
  console.log(`  Hex (first 64 bytes): ${data.subarray(0, 64).toString("hex")}`);

  try {
    const state = parseBattleAccount(data);
    printBattleState(state, battleId);
  } catch (e) {
    console.log(`\n[Parse error — struct layout may differ from IDL estimate]`);
    console.log(`  ${e instanceof Error ? e.message : e}`);
    console.log(`  Full hex dump:`);
    for (let i = 0; i < data.length; i += 32) {
      console.log(`    [${i.toString().padStart(3, " ")}] ${data.subarray(i, i + 32).toString("hex")}`);
    }
  }
}

main().catch((err) => {
  console.error(`\nError: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
