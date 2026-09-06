import { describe, it, expect } from "vitest";
import {
  b58encode, b58decode, battlePda, vaultPda, mintPda,
  rankHolders, impliedWinnerPot, impliedMultiple,
} from "../battlePositions";

// Every expected value below was read from Solana mainnet and is recorded in
// bettercallzaal/wavewarz-protocol. If one of these fails, the derivation is
// wrong - not the fixture.
describe("base58", () => {
  it("round-trips", () => {
    const s = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
    expect(b58encode(b58decode(s))).toBe(s);
  });
});

describe("PDA derivation", () => {
  it("derives the battle account for the first battle ever", () => {
    // Battle 1748233241, created 2025-05-26. Verified on chain.
    expect(battlePda(1748233241)).toBe("GvZDKKCY1xgPTSnbNpyfPafgc112SdvCyP4GUVEtsiZD");
  });

  it("derives the artist A mint", () => {
    expect(mintPda(1787568630, "a")).toBe("8rBafRobAMQWZiGmDnh6wwR45xWCatCnN14grmLBAwVi");
  });

  it("derives distinct addresses for the four PDAs", () => {
    const id = 1788580997;
    const set = new Set([battlePda(id), vaultPda(id), mintPda(id, "a"), mintPda(id, "b")]);
    expect(set.size).toBe(4);
  });
});

describe("rankHolders", () => {
  it("ranks by size and splits the pool by share", () => {
    const out = rankHolders(
      [{ owner: "A", amount: 25 }, { owner: "B", amount: 75 }],
      100,
      2,
    );
    expect(out[0].owner).toBe("B");
    expect(out[0].share).toBeCloseTo(0.75);
    expect(out[0].sol).toBeCloseTo(1.5);
  });

  it("drops zero balances rather than showing empty holders", () => {
    expect(rankHolders([{ owner: "A", amount: 0 }], 10, 1)).toHaveLength(0);
  });

  it("does not divide by a zero supply", () => {
    expect(rankHolders([{ owner: "A", amount: 5 }], 0, 1)[0].share).toBe(0);
  });
});

describe("settlement", () => {
  // winner + 0.40 * loser, measured on 1,506 of 1,506 settled battles.
  it("gives the winning side its own pool plus 40% of the loser's", () => {
    expect(impliedWinnerPot(10, 5)).toBeCloseTo(12);
  });

  it("returns the whole pot when the pools are exactly equal", () => {
    // The 24 battles that did not fit the formula all had equal pools.
    expect(impliedWinnerPot(4, 4)).toBeCloseTo(8);
  });

  it("expresses the multiple on a holder's stake", () => {
    expect(impliedMultiple(10, 5)).toBeCloseTo(1.2);
    expect(impliedMultiple(0, 5)).toBe(0);
  });
});
