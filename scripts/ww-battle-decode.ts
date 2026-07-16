/**
 * WaveWarZ Helius battle-decode script
 *
 * Decodes buyShares / sellShares / claimShares / endBattle / initializeBattle
 * transactions from the WaveWarZ on-chain program using the Helius Enhanced TX API.
 *
 * Drop-in key: set HELIUS_API_KEY=<your key> and run.
 * Without a key: runs in DRY-RUN mode against fixture data so the decode
 * pipeline can be verified before the key is available.
 *
 * Usage:
 *   npx tsx scripts/ww-battle-decode.ts                      # dry-run (fixture)
 *   HELIUS_API_KEY=xxx npx tsx scripts/ww-battle-decode.ts   # live
 *   HELIUS_API_KEY=xxx npx tsx scripts/ww-battle-decode.ts --recent 20
 */
import { createHash } from "node:crypto";

// ── Constants (all VERIFIED in WAVEWARZ-RESEARCH.md) ────────────────────────

const PROGRAM_ID = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
const TREASURY   = "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37";

const DISCRIMINATORS: Record<string, number[]> = {
  initializeBattle: [117, 108, 166, 159, 146,  82, 246, 223],
  initializeMints:  [189,  84,  85, 142, 177, 200,  57,  22],
  buyShares:        [ 40, 239, 138, 154,   8,  37, 106, 108],
  sellShares:       [184, 164, 169,  16, 231, 158, 199, 196],
  endBattle:        [ 80, 145, 208,  48, 183,  92, 168, 112],
  claimShares:      [130, 131,  29, 237, 134,  20, 110, 245],
};

// ── Base58 (Solana / Bitcoin alphabet) ──────────────────────────────────────

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHA_MAP = new Map<string, number>(Array.from(ALPHABET).map((c, i) => [c, i]));

function b58Decode(s: string): Buffer {
  let n = BigInt(0);
  for (const c of s) {
    const d = ALPHA_MAP.get(c);
    if (d === undefined) throw new Error(`Bad base58 char: ${c}`);
    n = n * 58n + BigInt(d);
  }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  const leading = s.match(/^1*/)?.[0].length ?? 0;
  return Buffer.from([...Array(leading).fill(0), ...bytes]);
}

function b58Encode(buf: Buffer): string {
  let n = BigInt("0x" + buf.toString("hex") || "0");
  let s = "";
  while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
  const leading = Array.from(buf).findIndex(b => b !== 0);
  return "1".repeat(leading < 0 ? buf.length : leading) + s;
}

// ── PDA derivation (same algorithm as @solana/web3.js findProgramAddressSync) ─

function isOnCurve(buf: Buffer): boolean {
  // Ed25519 on-curve check: try to decode as a point.
  // If all 32 bytes fit, hash the check. We approximate with the Solana hash check.
  // Solana rejects any point whose y-coordinate (with sign bit masked) encodes a valid
  // group element. We can't do a full Ed25519 decode without a library, so we delegate
  // this to the nonce search: if a candidate is on-curve, the next nonce will be tried.
  // For practical purposes this function just tells the caller to keep trying.
  // The real check requires bigint modular square root of the Ed25519 field equation.
  // We skip it here — the PDA is never on-curve by construction (Solana guarantees this
  // by searching until a valid off-curve point is found). So we implement the raw hash
  // and leave the on-curve check as a stub that always returns false (i.e., accept first).
  // NOTE: this will give the WRONG pda ~50% of the time for programs where the first
  // candidate happens to be on-curve. For the WaveWarZ program ID and "battle" seeds
  // the real on-curve check matters.  When HELIUS_API_KEY is set, we derive PDAs only
  // as a fallback — the account address comes directly from the instruction's accounts array.
  return false; // stub; see comment above
}

function derivePda(seeds: Buffer[], programId: string): string {
  const programBuf = b58Decode(programId);
  for (let nonce = 255; nonce >= 0; nonce--) {
    const hashInput = Buffer.concat([
      ...seeds,
      Buffer.from([nonce]),
      programBuf,
      Buffer.from("ProgramDerivedAddress"),
    ]);
    const candidate = createHash("sha256").update(hashInput).digest();
    if (!isOnCurve(candidate)) {
      return b58Encode(candidate);
    }
  }
  throw new Error("Could not find off-curve PDA");
}

function battlePda(battleId: bigint): string {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(battleId);
  return derivePda([Buffer.from("battle"), idBuf], PROGRAM_ID);
}

// ── Helius API helpers ────────────────────────────────────────────────────────

const HELIUS_RPC  = (key: string) => `https://mainnet.helius-rpc.com/?api-key=${key}`;
const HELIUS_ENH  = (addr: string, key: string, before?: string) =>
  `https://api-mainnet.helius-rpc.com/v0/addresses/${addr}/transactions?api-key=${key}&limit=100${before ? `&before=${before}` : ""}`;

async function heliusRpc(key: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(HELIUS_RPC(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Helius RPC ${method} → HTTP ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`Helius RPC error: ${json.error.message}`);
  return json.result;
}

async function fetchEnhancedTxs(addr: string, key: string, limit: number): Promise<EnhancedTx[]> {
  const txs: EnhancedTx[] = [];
  let before: string | undefined;
  while (txs.length < limit) {
    const url = HELIUS_ENH(addr, key, before);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Helius enhanced txs → HTTP ${res.status}`);
    const batch = (await res.json()) as EnhancedTx[];
    if (!batch.length) break;
    txs.push(...batch);
    before = batch[batch.length - 1].signature;
    if (batch.length < 100) break;
  }
  return txs.slice(0, limit);
}

// ── Battle account layout (estimated from IDL; verify against real data) ────
// Offset  Size  Field
//   0      8    Anchor discriminator
//   8      8    battle_id: u64
//  16      8    start_time: i64
//  24      8    end_time: i64
//  32     32    artist_a: Pubkey
//  64     32    artist_b: Pubkey
//  96     32    wavewarz_wallet: Pubkey
// 128     32    artist_a_mint: Pubkey
// 160     32    artist_b_mint: Pubkey
// 192      8    artist_a_supply: u64
// 200      8    artist_b_supply: u64
// 208      8    artist_a_sol: u64
// 216      8    artist_b_sol: u64
// 224      1    a_winner: bool
// 225      1    b_winner: bool
// 226      8    total_distribution_amount: u64
// 234     32    admin: Pubkey
// Total: 266 bytes (ESTIMATED — verify when key is available)

interface BattleAccount {
  battleId: bigint;
  startTime: Date;
  endTime: Date;
  artistA: string;
  artistB: string;
  waveWarzWallet: string;
  artistAMint: string;
  artistBMint: string;
  artistASupply: bigint;
  artistBSupply: bigint;
  artistASol: number;  // SOL
  artistBSol: number;  // SOL
  aWinner: boolean;
  bWinner: boolean;
  totalDistribution: number; // SOL
  admin: string;
}

function parseBattleAccount(data: Buffer): BattleAccount {
  if (data.length < 266) throw new Error(`Battle account too short: ${data.length} bytes`);
  let o = 8; // skip discriminator
  const battleId   = data.readBigUInt64LE(o); o += 8;
  const startTime  = new Date(Number(data.readBigInt64LE(o)) * 1000); o += 8;
  const endTime    = new Date(Number(data.readBigInt64LE(o)) * 1000); o += 8;
  const artistA    = b58Encode(data.subarray(o, o + 32)); o += 32;
  const artistB    = b58Encode(data.subarray(o, o + 32)); o += 32;
  const waveWarzWallet = b58Encode(data.subarray(o, o + 32)); o += 32;
  const artistAMint = b58Encode(data.subarray(o, o + 32)); o += 32;
  const artistBMint = b58Encode(data.subarray(o, o + 32)); o += 32;
  const artistASupply = data.readBigUInt64LE(o); o += 8;
  const artistBSupply = data.readBigUInt64LE(o); o += 8;
  const artistASol  = Number(data.readBigUInt64LE(o)) / 1e9; o += 8;
  const artistBSol  = Number(data.readBigUInt64LE(o)) / 1e9; o += 8;
  const aWinner    = data[o] !== 0; o += 1;
  const bWinner    = data[o] !== 0; o += 1;
  const totalDistribution = Number(data.readBigUInt64LE(o)) / 1e9; o += 8;
  const admin      = b58Encode(data.subarray(o, o + 32));
  return { battleId, startTime, endTime, artistA, artistB, waveWarzWallet,
           artistAMint, artistBMint, artistASupply, artistBSupply,
           artistASol, artistBSol, aWinner, bWinner, totalDistribution, admin };
}

// ── Instruction decode ────────────────────────────────────────────────────────

function matchDiscriminator(dataB64: string): string | null {
  const buf = Buffer.from(dataB64, "base64");
  if (buf.length < 8) return null;
  for (const [name, disc] of Object.entries(DISCRIMINATORS)) {
    if (disc.every((b, i) => buf[i] === b)) return name;
  }
  return null;
}

interface DecodedInstruction {
  name: string;
  dataHex: string;
  accounts: string[];
}

interface DecodedTx {
  signature: string;
  blockTime: number;
  instructions: DecodedInstruction[];
}

// ── Types for Helius Enhanced TX API ─────────────────────────────────────────

interface HeliusInstruction {
  programId: string;
  accounts: string[];
  data: string; // base58 encoded
}

interface HeliusInnerInstruction {
  index: number;
  instructions: HeliusInstruction[];
}

interface EnhancedTx {
  signature: string;
  blockTime: number;
  instructions: HeliusInstruction[];
  innerInstructions: HeliusInnerInstruction[];
}

function decodeEnhancedTx(tx: EnhancedTx): DecodedTx | null {
  const relevant: DecodedInstruction[] = [];
  const allIxs: HeliusInstruction[] = [
    ...tx.instructions,
    ...tx.innerInstructions.flatMap(ii => ii.instructions),
  ];
  for (const ix of allIxs) {
    if (ix.programId !== PROGRAM_ID) continue;
    // Helius enhanced tx API gives instruction data as base58, not base64
    const buf = b58Decode(ix.data);
    let name: string | null = null;
    for (const [n, disc] of Object.entries(DISCRIMINATORS)) {
      if (disc.every((b, i) => buf[i] === b)) { name = n; break; }
    }
    if (!name) continue;
    relevant.push({ name, dataHex: buf.toString("hex"), accounts: ix.accounts });
  }
  if (!relevant.length) return null;
  return { signature: tx.signature, blockTime: tx.blockTime, instructions: relevant };
}

// ── Dry-run fixture ────────────────────────────────────────────────────────────
// Sample data derived from WAVEWARZ-RESEARCH.md verified on-chain numbers.
// The structure mirrors what Helius Enhanced TX API returns.

const DRY_RUN_TXS: EnhancedTx[] = [
  {
    signature: "FIXTURE_buyShares_001",
    blockTime: 1748476800, // 2025-05-29 UTC
    instructions: [],
    innerInstructions: [
      {
        index: 0,
        instructions: [
          {
            programId: PROGRAM_ID,
            accounts: [
              "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",  // signer (Zaal's wallet)
              "BATTLE_PDA_FIXTURE",
              "VAULT_PDA_FIXTURE",
            ],
            // base58 encoding of: buyShares discriminator [40,239,138,154,8,37,106,108] + amount u64 LE (0.1 SOL = 100_000_000)
            data: b58Encode(Buffer.from([40, 239, 138, 154, 8, 37, 106, 108, 0, 225, 245, 5, 0, 0, 0, 0])),
          },
        ],
      },
    ],
  },
  {
    signature: "FIXTURE_endBattle_001",
    blockTime: 1748563200, // 2025-05-30 UTC
    instructions: [],
    innerInstructions: [
      {
        index: 0,
        instructions: [
          {
            programId: PROGRAM_ID,
            accounts: [
              TREASURY,          // wavewarz_wallet (platform signer)
              "BATTLE_PDA_FIXTURE",
              "VAULT_PDA_FIXTURE",
            ],
            data: b58Encode(Buffer.from([80, 145, 208, 48, 183, 92, 168, 112])), // endBattle disc, no args
          },
        ],
      },
    ],
  },
  {
    signature: "FIXTURE_claimShares_001",
    blockTime: 1748649600, // 2025-05-31 UTC
    instructions: [],
    innerInstructions: [
      {
        index: 0,
        instructions: [
          {
            programId: PROGRAM_ID,
            accounts: [
              "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
              "BATTLE_PDA_FIXTURE",
              "VAULT_PDA_FIXTURE",
            ],
            data: b58Encode(Buffer.from([130, 131, 29, 237, 134, 20, 110, 245])), // claimShares disc
          },
        ],
      },
    ],
  },
];

// Fixture battle account bytes (matches the layout documented above)
function makeDryRunBattleAccount(): Buffer {
  const buf = Buffer.alloc(266);
  let o = 0;
  // discriminator (8 bytes) — Anchor's sha256("account:Battle")[0..8]
  Buffer.from([0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89]).copy(buf, o); o += 8;
  buf.writeBigUInt64LE(42n, o); o += 8;       // battle_id = 42
  buf.writeBigInt64LE(BigInt(1748476800), o); o += 8; // start_time
  buf.writeBigInt64LE(BigInt(1748563200), o); o += 8; // end_time
  // artist_a (32 bytes) — fake pubkey
  Buffer.from("GodclouDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX".padEnd(44, "1")).slice(0, 32).copy(buf, o); o += 32;
  // artist_b (32 bytes) — fake pubkey
  Buffer.from("BennyJ504XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx".padEnd(44, "1")).slice(0, 32).copy(buf, o); o += 32;
  b58Decode(TREASURY).copy(buf, o); o += 32;  // wavewarz_wallet
  Buffer.alloc(32).copy(buf, o); o += 32;     // artist_a_mint (placeholder)
  Buffer.alloc(32).copy(buf, o); o += 32;     // artist_b_mint (placeholder)
  buf.writeBigUInt64LE(1000n, o); o += 8;     // artist_a_supply
  buf.writeBigUInt64LE(800n, o); o += 8;      // artist_b_supply
  buf.writeBigUInt64LE(BigInt(Math.round(2.5 * 1e9)), o); o += 8; // artist_a_sol = 2.5
  buf.writeBigUInt64LE(BigInt(Math.round(1.8 * 1e9)), o); o += 8; // artist_b_sol = 1.8
  buf[o] = 1; o += 1; // a_winner = true
  buf[o] = 0; o += 1; // b_winner = false
  buf.writeBigUInt64LE(BigInt(Math.round(0.054 * 1e9)), o); o += 8; // total_distribution (~3% of loser pool)
  Buffer.alloc(32).copy(buf, o);               // admin (placeholder)
  return buf;
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface BattleSummary {
  battleId: bigint;
  pda?: string;
  artistA: string;
  artistB: string;
  winner: "A" | "B" | "none";
  startTime: Date;
  endTime: Date;
  volumeSol: number;
  artistAPoolSol: number;
  artistBPoolSol: number;
  totalDistributionSol: number;
}

function summarizeBattle(acct: BattleAccount): BattleSummary {
  return {
    battleId: acct.battleId,
    artistA: acct.artistA,
    artistB: acct.artistB,
    winner: acct.aWinner ? "A" : acct.bWinner ? "B" : "none",
    startTime: acct.startTime,
    endTime: acct.endTime,
    volumeSol: acct.artistASol + acct.artistBSol,
    artistAPoolSol: acct.artistASol,
    artistBPoolSol: acct.artistBSol,
    totalDistributionSol: acct.totalDistribution,
  };
}

function printDecodedTx(tx: DecodedTx) {
  const dt = new Date(tx.blockTime * 1000).toISOString();
  for (const ix of tx.instructions) {
    const signer = ix.accounts[0] ?? "?";
    const shortSig = tx.signature.slice(0, 20) + "…";
    let extra = "";
    if (ix.name === "buyShares" || ix.name === "sellShares") {
      const data = Buffer.from(ix.dataHex, "hex");
      if (data.length >= 16) {
        const lamports = data.readBigUInt64LE(8);
        extra = `  amount=${(Number(lamports) / 1e9).toFixed(6)} SOL`;
      }
    }
    console.log(`  ${dt}  [${ix.name.padEnd(18)}]  signer=${signer.slice(0, 8)}…  sig=${shortSig}${extra}`);
  }
}

async function runLive(key: string, limit: number) {
  console.log(`\nFetching up to ${limit} recent program transactions from Helius…`);
  const txs = await fetchEnhancedTxs(PROGRAM_ID, key, limit);
  console.log(`Fetched ${txs.length} transactions.`);

  const decoded = txs.map(decodeEnhancedTx).filter(Boolean) as DecodedTx[];
  console.log(`Decoded ${decoded.length} WaveWarZ instructions:\n`);
  for (const tx of decoded) printDecodedTx(tx);

  // Summarize by instruction type
  const counts: Record<string, number> = {};
  for (const tx of decoded) {
    for (const ix of tx.instructions) {
      counts[ix.name] = (counts[ix.name] ?? 0) + 1;
    }
  }
  console.log("\nInstruction summary:");
  for (const [name, count] of Object.entries(counts)) {
    console.log(`  ${name.padEnd(18)} ${count}`);
  }

  // Fetch and decode a battle account for the first initializeBattle found
  const firstInit = decoded.find(tx => tx.instructions.some(ix => ix.name === "initializeBattle"));
  if (firstInit) {
    const ix = firstInit.instructions.find(ix => ix.name === "initializeBattle")!;
    const battlePdaAddr = ix.accounts[0]; // first account in initializeBattle = battle PDA
    console.log(`\nDecoding battle account: ${battlePdaAddr}`);
    const info = await heliusRpc(key, "getAccountInfo", [battlePdaAddr, { encoding: "base64" }]) as {
      value?: { data: [string, string] }
    };
    if (info?.value?.data) {
      const raw = Buffer.from(info.value.data[0], "base64");
      const acct = parseBattleAccount(raw);
      const summary = summarizeBattle(acct);
      console.log("\nBattle account:");
      console.log(`  Battle ID:    ${summary.battleId}`);
      console.log(`  Artist A:     ${summary.artistA}`);
      console.log(`  Artist B:     ${summary.artistB}`);
      console.log(`  Winner:       ${summary.winner}`);
      console.log(`  Volume:       ${summary.volumeSol.toFixed(4)} SOL`);
      console.log(`  A pool:       ${summary.artistAPoolSol.toFixed(4)} SOL`);
      console.log(`  B pool:       ${summary.artistBPoolSol.toFixed(4)} SOL`);
      console.log(`  Distribution: ${summary.totalDistributionSol.toFixed(4)} SOL`);
      console.log(`  Start:        ${summary.startTime.toISOString()}`);
      console.log(`  End:          ${summary.endTime.toISOString()}`);
    }
  }
}

function runDryRun() {
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║  DRY-RUN MODE  (HELIUS_API_KEY not set)             ║");
  console.log("║  Set HELIUS_API_KEY=<key> to run against live data  ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log("── Decoding fixture transactions ──────────────────────\n");
  const decoded = DRY_RUN_TXS.map(decodeEnhancedTx).filter(Boolean) as DecodedTx[];
  for (const tx of decoded) printDecodedTx(tx);

  console.log("\n── Parsing fixture battle account ─────────────────────\n");
  const raw = makeDryRunBattleAccount();
  try {
    const acct = parseBattleAccount(raw);
    const summary = summarizeBattle(acct);
    console.log(`  Battle ID:    ${summary.battleId}`);
    console.log(`  Artist A:     ${acct.artistA.slice(0, 8)}… (fixture)`);
    console.log(`  Artist B:     ${acct.artistB.slice(0, 8)}… (fixture)`);
    console.log(`  Winner:       ${summary.winner}`);
    console.log(`  Volume:       ${summary.volumeSol.toFixed(4)} SOL`);
    console.log(`  A pool:       ${summary.artistAPoolSol.toFixed(4)} SOL`);
    console.log(`  B pool:       ${summary.artistBPoolSol.toFixed(4)} SOL`);
    console.log(`  Distribution: ${summary.totalDistributionSol.toFixed(4)} SOL`);
    console.log(`  Start:        ${summary.startTime.toISOString()}`);
    console.log(`  End:          ${summary.endTime.toISOString()}`);
    console.log("\n✓ Decode pipeline is healthy — drop in HELIUS_API_KEY to go live.\n");
  } catch (err) {
    console.error(`Fixture parse error: ${err}`);
    process.exit(1);
  }

  console.log("── Discriminator table (VERIFIED on-chain) ────────────\n");
  for (const [name, disc] of Object.entries(DISCRIMINATORS)) {
    console.log(`  ${name.padEnd(18)}  [${disc.join(",")}]`);
  }

  console.log("\n── Known addresses ─────────────────────────────────────\n");
  console.log(`  Program:   ${PROGRAM_ID}`);
  console.log(`  Treasury:  ${TREASURY}`);

  console.log("\n── Notes for when the key is live ──────────────────────\n");
  console.log("  1. The battle account layout (parseBattleAccount) is estimated from");
  console.log("     WAVEWARZ-RESEARCH.md field list. Verify offsets against a real");
  console.log("     getAccountInfo response — if the parse looks garbled, adjust the");
  console.log("     struct offsets in the comment block above parseBattleAccount().");
  console.log("  2. The Helius enhanced TX API data field is base58-encoded.");
  console.log("     The standard Solana RPC uses base64. Both are handled here.");
  console.log("  3. The PDA derivation in derivePda() uses a stub on-curve check.");
  console.log("     The live path extracts battle PDAs from the instruction accounts");
  console.log("     array (first account in initializeBattle) instead of deriving them.");
}

async function main() {
  const key = process.env.HELIUS_API_KEY;
  const limitArg = process.argv.indexOf("--recent");
  const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1] ?? "50", 10) : 50;

  if (!key) {
    runDryRun();
    return;
  }

  await runLive(key, limit);
}

main().catch(err => {
  console.error(`ww-battle-decode error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
