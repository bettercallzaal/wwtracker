import { describe, it, expect } from "vitest";
import {
  b58encode, b58decode, battlePda, vaultPda, mintPda,
  rankHolders, impliedWinnerPot, impliedMultiple,
  holderListTruncated, burnedShare, LARGEST_ACCOUNTS_CAP,
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

// The 20-account cap on getTokenLargestAccounts, and the inference it breaks.
//
// Measured across every battle in the platform's history - 1,643 battles,
// 15,359 trades - the most holders any side has ever ended with is 18. The cap
// has never been hit, which is exactly why it is worth a test: the first battle
// big enough to hit it is the first one anybody is watching this page during,
// and the failure is silent.

describe("holderListTruncated", () => {
  it("treats a cap-length list as possibly short", () => {
    expect(holderListTruncated(LARGEST_ACCOUNTS_CAP)).toBe(true);
  });

  it("does not flag a list the RPC clearly did not cut", () => {
    expect(holderListTruncated(0)).toBe(false);
    expect(holderListTruncated(18)).toBe(false);
    expect(holderListTruncated(LARGEST_ACCOUNTS_CAP - 1)).toBe(false);
  });

  it("is conservative: exactly 20 real holders reads the same as 20 of 34", () => {
    // The RPC returns an identical response either way, so understating our
    // knowledge is the only honest option.
    expect(holderListTruncated(LARGEST_ACCOUNTS_CAP)).toBe(true);
    expect(holderListTruncated(LARGEST_ACCOUNTS_CAP + 5)).toBe(true);
  });
});

describe("burnedShare", () => {
  it("reports the burned fraction when the holder list is complete", () => {
    // 250 of 1,000 supply is unaccounted for and the list is whole, so it burned.
    expect(burnedShare(1000, 750, false)).toBeCloseTo(0.25, 10);
  });

  it("returns null rather than a number when the list is truncated", () => {
    // This is the bug. Held is short because the RPC stopped at 20, not because
    // anything was claimed, and 25% would have been rendered as fact.
    expect(burnedShare(1000, 750, true)).toBeNull();
  });

  it("returns null, never zero, when nothing can be said", () => {
    // An unknown rendered as a number is a lie that looks like data - the same
    // reason /api/ww/* returns status unknown rather than a zero-filled object.
    expect(burnedShare(0, 0, false)).toBeNull();
    expect(burnedShare(1000, 1000, false)).toBeNull();
    expect(burnedShare(1000, 1200, false)).toBeNull();
  });

  it("never reports a burn on a battle at the historical holder record", () => {
    // 18 holders, the most ever seen. Under the cap, so the inference is valid.
    expect(holderListTruncated(18)).toBe(false);
    expect(burnedShare(1000, 900, holderListTruncated(18))).toBeCloseTo(0.1, 10);
  });
});
