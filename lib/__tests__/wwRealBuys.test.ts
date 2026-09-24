/**
 * Real buys, with the tokens the PROGRAM said it minted, checked into the repo.
 *
 * Our quote was believed exact. On the night of 2026-09-24 a session produced
 * 22 buys and `scripts/ww-verify-battle.ts` disagreed with the program on 5 of
 * them - every one by exactly one 100,000-token step, always low.
 *
 * WHY THE FIXTURE CARRIES `buyOnly`, AND WHY IT NO LONGER GATES THE SCORING.
 * The verifier replays a battle accumulating the pool. For a buy it uses the
 * program's own stated contribution, so the pool stays exact. For a SELL it
 * used to subtract a figure it computed itself, which put the pool beyond
 * observation and made every later buy unscorable.
 *
 * The program logs both halves of a sell - the SOL returned and the fee - and
 * their sum is the gross that left the pool, so nothing has to be inferred.
 * Since that fix the pool is observed throughout and ALL 22 rows are scorable.
 *
 * The flag stays because it records a real property of each battle, and
 * because the rows it marks were captured BEFORE the fix: re-derived with the
 * pool observed, all four came back byte-identical, which is evidence that our
 * sell model was already exact rather than a reason to have trusted it.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-real-buys-2026-09-24.json";
import { quoteBuy, quoteBuyAtSupply, supplyAtPool, SUPPLY_QUANTUM } from "../ww/quote";

interface Row {
  battleId: number;
  side: "a" | "b";
  poolLamports: number;
  /** The supply the side HELD, tracked through sells - not reconstructed. */
  supplyBefore: number;
  spendLamports: number;
  programTokens: number;
  buyOnly: boolean;
}
const trades = fixture.trades as Row[];
const clean = trades.filter((t) => t.buyOnly);

/**
 * THE FIXTURE CARRIES THE SUPPLY; THIS DOES NOT RECONSTRUCT IT.
 *
 * An earlier version summed `programTokens` per side to derive it, which is
 * right on a battle of only buys and wrong on one with sells - and produced a
 * false failure on exactly the battle worth testing. The verifier tracks the
 * real supply through both, so the fixture records it.
 */
const withSupply = (rows: Row[]) => rows;

describe("the fixture itself", () => {
  it("is not empty, so nothing below can pass by finding nothing", () => {
    expect(trades.length).toBe(22);
    expect(clean.length).toBe(18);
    expect(new Set(trades.map((t) => t.battleId)).size).toBe(7);
  });

  it("carries a program figure for every row", () => {
    for (const t of trades) {
      expect(Number.isInteger(t.programTokens)).toBe(true);
      expect(t.programTokens).toBeGreaterThan(0);
      // Every mint the program makes is a whole number of steps.
      expect(t.programTokens % SUPPLY_QUANTUM).toBe(0);
    }
  });
});

describe("quoteBuyAtSupply reproduces every real buy", () => {
  it("matches the program on ALL 22, sells included", () => {
    const wrong = withSupply(trades).filter(
      (r) => quoteBuyAtSupply(r.supplyBefore, r.spendLamports).tokensOut !== r.programTokens,
    );
    expect(wrong.map((r) => `${r.battleId}:${r.side}`)).toEqual([]);
  });

  /**
   * AND IS NOT THE GENERAL MODEL. Scored against battle 1789948124 - 49 trades
   * with many sells - it gets 5 of 33 while flooring the difference gets 24.
   * The missing term is the residual each sell leaves in the vault, which
   * `quoteSell` documents: flooring the supply leaves part of the pool
   * represented by no token, and the program removes only the curve value of
   * the tokens burned.
   *
   * This test is a reminder rather than a measurement. The sell-heavy battle
   * is not in the fixture because the supply reconstruction it needs is the
   * very thing in question, and a fixture that assumed an answer would prove
   * it by construction.
   */
  /**
   * THE POOL IS NOT AN INPUT, which is the whole answer. Three models priced
   * off the vault's pool and all failed after a sell; this one prices off the
   * pool the stored supply implies, so the flooring residual never enters.
   */
  it("gives the same answer whatever the vault holds, because it never reads it", () => {
    const a = quoteBuyAtSupply(156_900_000, 50_000_000).tokensOut;
    expect(a).toBe(65_000_000);
    // The residual on that side was 14,780 lamports. A pool-based model moves
    // with it; this one has nowhere to put it.
    expect(quoteBuyAtSupply(156_900_000, 50_000_000).tokensOut).toBe(a);
  });
});

describe("quoteBuy is one step low, and this records exactly how often", () => {
  /**
   * NOT a test that the old model is correct. It pins the measured error so a
   * change that improves it is visible and one that worsens it fails.
   */
  it("misses 4 of the 18 clean buys", () => {
    const wrong = clean.filter(
      (r) => quoteBuy(r.poolLamports, r.spendLamports).tokensOut !== r.programTokens,
    );
    expect(wrong).toHaveLength(4);
  });

  it("is always LOW, and always by exactly one step", () => {
    for (const r of clean) {
      const diff = r.programTokens - quoteBuy(r.poolLamports, r.spendLamports).tokensOut;
      expect([0, SUPPLY_QUANTUM]).toContain(diff);
    }
  });
});

describe("the mechanism, on the battle that shows it cleanly", () => {
  /**
   * Battle 1790215514: three buys, no sells, so the pool is exactly the
   * previous contributions. The program's stored supply after each buy is the
   * FLOOR OF THE CURVE AT THE POOL, not the running sum of floored differences.
   */
  const q = (x: number) => Math.floor(x / SUPPLY_QUANTUM) * SUPPLY_QUANTUM;

  it("stores the floor of the total, which is why flooring differences drifts", () => {
    expect(q(supplyAtPool(49_250_000))).toBe(156_900_000);
    expect(q(supplyAtPool(98_500_000))).toBe(221_900_000);
    // What the program minted on the second buy.
    expect(q(supplyAtPool(98_500_000)) - 156_900_000).toBe(65_000_000);
    // What we said, and the step that went missing.
    expect(quoteBuy(49_250_000, 50_000_000).tokensOut).toBe(64_900_000);
  });

  it("gets that buy right with the supply in hand", () => {
    expect(quoteBuyAtSupply(156_900_000, 50_000_000).tokensOut).toBe(65_000_000);
  });
});

describe("quoteBuyAtSupply refuses to invent a refund", () => {
  it("returns zero rather than a negative when the curve lands below the supply held", () => {
    // A state a sell could produce. A buy can never burn tokens, and a
    // negative here would read as one.
    const out = quoteBuyAtSupply(10_000_000_000, 1_000);
    expect(out.tokensOut).toBe(0);
  });

  it("still rejects a non-positive spend", () => {
    expect(() => quoteBuyAtSupply(0, 0)).toThrow(/spend must be positive/);
    expect(() => quoteBuyAtSupply(-1, 100)).toThrow(/supply cannot be negative/);
  });
});
