/**
 * The settle preview against the program's own EndBattle log for battle
 * 1789948124 (2026-09-21), and the vault delta measured in that transaction.
 */
import { describe, expect, it } from "vitest";
import { describeAge, secondsSinceEnd, settlePreview } from "../ww/settle";
import fixture from "../__fixtures__/ww-pool-backfill-transactions.json";

const POOL_A = 37_886_360;
const POOL_B = 1_488_815_340;

describe("settlePreview", () => {
  it("names the larger pool as the program's winner", () => {
    expect(settlePreview(POOL_A, POOL_B).winner).toBe("b");
    expect(settlePreview(POOL_B, POOL_A).winner).toBe("a");
  });

  /**
   * MEASURED, NOT ASSUMED. Battle 1790042941 ended 2026-09-22 with exactly
   * 49,250,000 lamports on each side. Simulating endBattle on it, the program
   * logged "Winner decided: true, Winner is artist A: false". The first
   * version of this pin said ties go to A.
   */
  it("gives a tie to B, as the program does, and says it was a tie", () => {
    const p = settlePreview(49_250_000, 49_250_000);
    expect(p.winner).toBe("b");
    expect(p.tie).toBe(true);
    expect(p.winnerDistribution).toBe(49_250_000 + 19_700_000);
    expect(settlePreview(6, 5).tie).toBe(false);
  });

  it("reproduces the EndBattle log's numbers exactly", () => {
    const p = settlePreview(POOL_A, POOL_B);
    expect(p.winnerPoolLamports).toBe(1_488_815_340);
    expect(p.winnerShareFromLoser).toBe(15_154_544);
    expect(p.winnerDistribution).toBe(1_503_969_884);
    expect(p.loserSharePool).toBe(18_943_180);
  });

  it("the 10% that leaves the vault matches the measured vault delta within a lamport", () => {
    const tx = fixture.transactions.EndBattle;
    const vi = tx.transaction.message.accountKeys.indexOf(fixture.vault);
    const vaultDelta = tx.meta.postBalances[vi] - tx.meta.preBalances[vi];
    const p = settlePreview(POOL_A, POOL_B);
    expect(p.leavesVaultLamports).toBe(3_788_636);
    expect(Math.abs(-vaultDelta - p.leavesVaultLamports)).toBeLessThanOrEqual(1);
  });

  it("the three legs add back to the losing pool", () => {
    const p = settlePreview(POOL_A, POOL_B);
    expect(p.winnerShareFromLoser + p.loserSharePool + p.leavesVaultLamports).toBe(p.loserPoolLamports);
  });

  it("flags an empty battle and refuses fractional or negative pools", () => {
    expect(settlePreview(0, 0).empty).toBe(true);
    expect(settlePreview(1, 0).empty).toBe(false);
    expect(() => settlePreview(1.5, 0)).toThrow(/whole/);
    expect(() => settlePreview(-1, 0)).toThrow(/whole/);
  });
});

describe("age", () => {
  it("never goes negative and reads like a person wrote it", () => {
    expect(secondsSinceEnd(100, 50)).toBe(0);
    expect(describeAge(30)).toBe("30s ago");
    expect(describeAge(600)).toBe("10 min ago");
    expect(describeAge(7200)).toBe("2 h ago");
    expect(describeAge(3 * 86_400)).toBe("3 days ago");
  });
});
