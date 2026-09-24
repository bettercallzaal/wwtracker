/**
 * Real buys, with the tokens the PROGRAM said it minted, checked into the repo.
 *
 * Our quote was believed exact. On the night of 2026-09-24 a session produced
 * 22 buys and `scripts/ww-verify-battle.ts` disagreed with the program on 5 of
 * them - every one by exactly one 100,000-token step, always low.
 *
 * WHY THE FIXTURE SPLITS ON `buyOnly`. The verifier replays a battle and
 * accumulates the pool as it goes. For a buy it uses the program's own stated
 * contribution, so the pool stays exact. For a SELL it subtracts a figure it
 * computed itself - so after any sell the pool is derived rather than
 * observed, and a buy scored against it cannot tell a wrong buy model from a
 * wrong sell model. Those rows are kept but never used to score.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-real-buys-2026-09-24.json";
import { quoteBuy, quoteBuyAtSupply, supplyAtPool, SUPPLY_QUANTUM } from "../ww/quote";

interface Row {
  battleId: number;
  side: "a" | "b";
  poolLamports: number;
  spendLamports: number;
  programTokens: number;
  buyOnly: boolean;
}
const trades = fixture.trades as Row[];
const clean = trades.filter((t) => t.buyOnly);

/** The supply a side holds before each buy, from the program's own numbers. */
function withSupply(rows: Row[]): Array<Row & { supplyBefore: number }> {
  const held = new Map<string, number>();
  return rows.map((r) => {
    const key = `${r.battleId}:${r.side}`;
    const supplyBefore = held.get(key) ?? 0;
    held.set(key, supplyBefore + r.programTokens);
    return { ...r, supplyBefore };
  });
}

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

describe("quoteBuyAtSupply reproduces every clean buy", () => {
  it("matches the program on all 18", () => {
    const wrong = withSupply(clean).filter(
      (r) => quoteBuyAtSupply(r.poolLamports, r.spendLamports, r.supplyBefore).tokensOut !== r.programTokens,
    );
    expect(wrong.map((r) => `${r.battleId}:${r.side}`)).toEqual([]);
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
    expect(quoteBuyAtSupply(49_250_000, 50_000_000, 156_900_000).tokensOut).toBe(65_000_000);
  });
});

describe("quoteBuyAtSupply refuses to invent a refund", () => {
  it("returns zero rather than a negative when the curve lands below the supply held", () => {
    // A state a sell could produce. A buy can never burn tokens, and a
    // negative here would read as one.
    const out = quoteBuyAtSupply(1_000, 1_000, 10_000_000_000);
    expect(out.tokensOut).toBe(0);
  });

  it("still rejects a non-positive spend", () => {
    expect(() => quoteBuyAtSupply(0, 0, 0)).toThrow(/spend must be positive/);
    expect(() => quoteBuyAtSupply(0, 100, -1)).toThrow(/supply cannot be negative/);
  });
});
