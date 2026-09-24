/**
 * The Battle account carries TWO SOL numbers per side, and this file read the
 * wrong one for its whole life.
 *
 *     196 artist_a_supply        204 artist_b_supply
 *     212 artist_a_sol_balance   220 artist_b_sol_balance
 *     228 artist_a_pool          236 artist_b_pool
 *
 * `discovery.ts` had `poolA: 212`, which is `artist_a_sol_balance`. Swept
 * across all 1,709 battle accounts on 2026-09-24, the two fields hold the same
 * value on every side of every one - so nothing downstream was wrong and the
 * change to 228 is a no-op on all real data. The flag exists because that is a
 * measurement of today, not a property of the program.
 */
import { describe, expect, it } from "vitest";
import { parseBattleAccount, type ProgramAccountRow } from "../ww/discovery";

const decode = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

/** A battle account with the two SOL pairs set independently. */
function account(opts: {
  balanceA: number;
  balanceB: number;
  poolA: number;
  poolB: number;
}): ProgramAccountRow {
  const raw = new Uint8Array(353);
  const dv = new DataView(raw.buffer);
  dv.setBigUint64(8, BigInt(1_790_215_514), true); // battle id
  dv.setBigInt64(20, BigInt(1_790_215_514), true); // start
  dv.setBigInt64(28, BigInt(1_790_215_900), true); // end
  dv.setBigUint64(212, BigInt(opts.balanceA), true);
  dv.setBigUint64(220, BigInt(opts.balanceB), true);
  dv.setBigUint64(228, BigInt(opts.poolA), true);
  dv.setBigUint64(236, BigInt(opts.poolB), true);
  raw[245] = 1; // settled, so the phase is deterministic
  return { pubkey: "Gu9vkizJtwBC97Z2xfiaxjuTEJDaYmPmpVhrP9Zy5jB8", account: { data: [Buffer.from(raw).toString("base64"), "base64"] } };
}

describe("the pool comes from 228 and 236", () => {
  it("reads the pool fields, not the balance fields", () => {
    // Deliberately different, which no real battle is - that is the point.
    const b = parseBattleAccount(account({ balanceA: 11, balanceB: 22, poolA: 333, poolB: 444 }), decode);
    expect(b?.poolLamports).toEqual({ a: 333, b: 444 });
  });

  it("flags the disagreement rather than silently picking one", () => {
    const b = parseBattleAccount(account({ balanceA: 11, balanceB: 22, poolA: 333, poolB: 444 }), decode);
    expect(b?.poolDisagreesWithBalance).toBe(true);
  });

  it("does not flag the real shape, where the two agree", () => {
    const b = parseBattleAccount(
      account({ balanceA: 49_250_000, balanceB: 98_500_000, poolA: 49_250_000, poolB: 98_500_000 }),
      decode,
    );
    expect(b?.poolDisagreesWithBalance).toBe(false);
    expect(b?.poolLamports).toEqual({ a: 49_250_000, b: 98_500_000 });
  });

  it("flags a disagreement on either side alone", () => {
    const onlyA = parseBattleAccount(account({ balanceA: 1, balanceB: 22, poolA: 2, poolB: 22 }), decode);
    const onlyB = parseBattleAccount(account({ balanceA: 11, balanceB: 1, poolA: 11, poolB: 2 }), decode);
    expect(onlyA?.poolDisagreesWithBalance).toBe(true);
    expect(onlyB?.poolDisagreesWithBalance).toBe(true);
  });
});

describe("a buffer too short to hold the pool fields", () => {
  /**
   * The old offsets ended at 227. Reading 228 and 236 needs 244 bytes, and a
   * caller passing a shorter slice would otherwise read past the end and get
   * an exception or a garbage number.
   */
  it("is refused rather than read past", () => {
    const raw = new Uint8Array(240);
    const dv = new DataView(raw.buffer);
    dv.setBigUint64(8, BigInt(1_790_215_514), true);
    const row: ProgramAccountRow = {
      pubkey: "Gu9vkizJtwBC97Z2xfiaxjuTEJDaYmPmpVhrP9Zy5jB8",
      account: { data: [Buffer.from(raw).toString("base64"), "base64"] },
    };
    expect(parseBattleAccount(row, decode)).toBeNull();
  });
});
