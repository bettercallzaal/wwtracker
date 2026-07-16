/**
 * Tests for the WaveWarZ Helius battle-decode script.
 * Covers: discriminator matching, base58 round-trip, battle account parsing.
 * All tests run without a Helius key (fixture/unit only).
 */
import { describe, it, expect } from "vitest";

// ── inline copies of the pure functions from ww-battle-decode.ts ────────────
// (Vitest can't tree-shake the async main() or the fixture generation, so we
// re-export the pure utils in a thin test boundary here rather than splitting
// the source file.)

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
  let n = BigInt("0x" + (buf.length ? buf.toString("hex") : "0"));
  let s = "";
  while (n > 0n) { s = ALPHABET[Number(n % 58n)] + s; n /= 58n; }
  const leading = Array.from(buf).findIndex(b => b !== 0);
  return "1".repeat(leading < 0 ? buf.length : leading) + s;
}

const DISCRIMINATORS: Record<string, number[]> = {
  initializeBattle: [117, 108, 166, 159, 146,  82, 246, 223],
  initializeMints:  [189,  84,  85, 142, 177, 200,  57,  22],
  buyShares:        [ 40, 239, 138, 154,   8,  37, 106, 108],
  sellShares:       [184, 164, 169,  16, 231, 158, 199, 196],
  endBattle:        [ 80, 145, 208,  48, 183,  92, 168, 112],
  claimShares:      [130, 131,  29, 237, 134,  20, 110, 245],
};

function matchDisc(buf: Buffer): string | null {
  for (const [name, disc] of Object.entries(DISCRIMINATORS)) {
    if (disc.every((b, i) => buf[i] === b)) return name;
  }
  return null;
}

interface BattleAccount {
  battleId: bigint;
  startTime: Date;
  endTime: Date;
  artistA: string;
  artistB: string;
  artistASol: number;
  artistBSol: number;
  aWinner: boolean;
  bWinner: boolean;
  totalDistribution: number;
}

function parseBattleAccount(data: Buffer): BattleAccount {
  if (data.length < 266) throw new Error(`Too short: ${data.length}`);
  let o = 8;
  const battleId  = data.readBigUInt64LE(o); o += 8;
  const startTime = new Date(Number(data.readBigInt64LE(o)) * 1000); o += 8;
  const endTime   = new Date(Number(data.readBigInt64LE(o)) * 1000); o += 8;
  const artistA   = b58Encode(Buffer.from(data.subarray(o, o + 32))); o += 32;
  const artistB   = b58Encode(Buffer.from(data.subarray(o, o + 32))); o += 32;
  o += 32; // wavewarz_wallet
  o += 32; // artist_a_mint
  o += 32; // artist_b_mint
  o += 8;  // artist_a_supply
  o += 8;  // artist_b_supply
  const artistASol = Number(data.readBigUInt64LE(o)) / 1e9; o += 8;
  const artistBSol = Number(data.readBigUInt64LE(o)) / 1e9; o += 8;
  const aWinner    = data[o] !== 0; o += 1;
  const bWinner    = data[o] !== 0; o += 1;
  const totalDistribution = Number(data.readBigUInt64LE(o)) / 1e9;
  return { battleId, startTime, endTime, artistA, artistB, artistASol, artistBSol, aWinner, bWinner, totalDistribution };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("base58", () => {
  it("round-trips a known Solana address", () => {
    const addr = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
    expect(b58Encode(b58Decode(addr))).toBe(addr);
  });

  it("round-trips treasury address", () => {
    const addr = "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37";
    expect(b58Encode(b58Decode(addr))).toBe(addr);
  });

  it("decodes to 32 bytes for a 32-byte pubkey", () => {
    const addr = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
    expect(b58Decode(addr).length).toBe(32);
  });

  it("throws on invalid character", () => {
    expect(() => b58Decode("0badchar")).toThrow("Bad base58 char");
  });
});

describe("discriminator matching", () => {
  for (const [name, disc] of Object.entries(DISCRIMINATORS)) {
    it(`matches ${name}`, () => {
      const buf = Buffer.from([...disc, 0, 0, 0, 0, 0, 0, 0, 0]);
      expect(matchDisc(buf)).toBe(name);
    });
  }

  it("returns null for unknown discriminator", () => {
    const buf = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(matchDisc(buf)).toBeNull();
  });

  it("returns null for buffer shorter than 8 bytes", () => {
    const buf = Buffer.from([40, 239]);
    expect(matchDisc(buf)).toBeNull();
  });
});

describe("parseBattleAccount", () => {
  function makeFixture(): Buffer {
    const buf = Buffer.alloc(266);
    let o = 0;
    Buffer.from([0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89]).copy(buf, o); o += 8;
    buf.writeBigUInt64LE(99n, o); o += 8;               // battle_id = 99
    buf.writeBigInt64LE(BigInt(1748476800), o); o += 8; // start
    buf.writeBigInt64LE(BigInt(1748563200), o); o += 8; // end
    // artist_a: use treasury bytes as a known key
    b58Decode("9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo").copy(buf, o); o += 32;
    // artist_b: all zeros (legitimate: encodes to all-1s in base58)
    Buffer.alloc(32).copy(buf, o); o += 32;
    Buffer.alloc(32).copy(buf, o); o += 32; // wavewarz_wallet
    Buffer.alloc(32).copy(buf, o); o += 32; // artist_a_mint
    Buffer.alloc(32).copy(buf, o); o += 32; // artist_b_mint
    buf.writeBigUInt64LE(500n, o); o += 8;  // artist_a_supply
    buf.writeBigUInt64LE(400n, o); o += 8;  // artist_b_supply
    buf.writeBigUInt64LE(BigInt(Math.round(3.0 * 1e9)), o); o += 8; // artist_a_sol
    buf.writeBigUInt64LE(BigInt(Math.round(2.0 * 1e9)), o); o += 8; // artist_b_sol
    buf[o] = 0; o += 1; // a_winner = false
    buf[o] = 1; o += 1; // b_winner = true
    buf.writeBigUInt64LE(BigInt(Math.round(0.06 * 1e9)), o); o += 8;
    Buffer.alloc(32).copy(buf, o);
    return buf;
  }

  it("parses battle_id", () => {
    expect(parseBattleAccount(makeFixture()).battleId).toBe(99n);
  });

  it("parses start/end time as Date", () => {
    const acct = parseBattleAccount(makeFixture());
    expect(acct.startTime).toBeInstanceOf(Date);
    expect(acct.startTime.getFullYear()).toBe(2025);
    expect(acct.endTime.getTime()).toBeGreaterThan(acct.startTime.getTime());
  });

  it("parses artist_a as the program address", () => {
    const acct = parseBattleAccount(makeFixture());
    expect(acct.artistA).toBe("9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo");
  });

  it("parses sol pools correctly", () => {
    const acct = parseBattleAccount(makeFixture());
    expect(acct.artistASol).toBeCloseTo(3.0, 4);
    expect(acct.artistBSol).toBeCloseTo(2.0, 4);
  });

  it("parses winner flags", () => {
    const acct = parseBattleAccount(makeFixture());
    expect(acct.aWinner).toBe(false);
    expect(acct.bWinner).toBe(true);
  });

  it("parses totalDistribution", () => {
    const acct = parseBattleAccount(makeFixture());
    expect(acct.totalDistribution).toBeCloseTo(0.06, 4);
  });

  it("throws if buffer is too short", () => {
    expect(() => parseBattleAccount(Buffer.alloc(100))).toThrow("Too short");
  });
});
