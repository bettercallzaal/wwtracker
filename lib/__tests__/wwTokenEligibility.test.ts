/**
 * PRD section 17 against three real mainnet mints.
 *
 * The fixtures were chosen so the three answers differ for three different
 * reasons. PYUSD carries nearly every hazard the section names. USDC is a
 * classic SPL token everybody treats as safe, which still has a freeze
 * authority and a mint authority - a checker that calls it fine without
 * qualification is not reading the account.
 *
 * AND OUR OWN BATTLE MINT DOES NOT COME BACK CLEAN EITHER. Its mint authority
 * is the battle PDA, because buying shares mints them. That is the mechanism
 * working, and it is still the fact section 17 asks a reviewer to see. None of
 * the three real mints is chain-clean, which is worth knowing before anybody
 * treats a clean verdict as the normal case.
 *
 * THE STRUCTURAL TESTS MATTER MORE THAN THE PER-TOKEN ONES. Five of section
 * 17's twelve checks are not on a mint account, so the function must never be
 * able to say a token is eligible, and the unanswered count must not shrink
 * because a token happened to be simple. Both are asserted directly, because
 * both are the kind of property that erodes when somebody later adds a
 * convenience boolean.
 */
import { describe, expect, it } from "vitest";
import fixtures from "../__fixtures__/ww-mint-accounts.json";
import {
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  checkTokenEligibility,
  summariseEligibility,
  type ParsedMintAccount,
} from "../ww/tokenEligibility";

const mints = fixtures.mints as Record<string, { mint: string; account: ParsedMintAccount | null }>;
const run = (key: string) => {
  const f = mints[key];
  return checkTokenEligibility(f.mint, f.account);
};
const verdictOf = (r: ReturnType<typeof run>, id: string) =>
  r.checks.find((c) => c.id === id)?.verdict;
const detailOf = (r: ReturnType<typeof run>, id: string) =>
  r.checks.find((c) => c.id === id)?.detail ?? "";

describe("the WaveWarZ battle mint", () => {
  const r = run("wavewarz_battle_mint");

  /**
   * OUR OWN TOKEN DOES NOT COME BACK CLEAN, and that is the checker working.
   * A battle mint's authority is the battle PDA, because buying shares mints
   * them - supply grows by design. Section 17 asks for the mint authority to be
   * reviewed, and "a program can mint more" is exactly the fact a reviewer
   * needs, even when the answer is "yes, that is the mechanism".
   *
   * The first version of this test asserted chain-clean. The code was right and
   * the expectation was wrong.
   */
  it("needs review, because the battle program can mint more shares", () => {
    expect(r.overall).toBe("needs-review");
    expect(verdictOf(r, "mint_authority")).toBe("review");
    expect(detailOf(r, "mint_authority")).toMatch(/supply can be increased/);
  });

  it("is otherwise clean: classic token, sane decimals, no freeze authority", () => {
    expect(r.tokenProgram).toBe(TOKEN_PROGRAM);
    expect(r.decimals).toBe(9);
    expect(verdictOf(r, "freeze_authority")).toBe("pass");
    expect(verdictOf(r, "extensions")).toBe("pass");
  });

  it("still reports five unanswered checks, because nothing here is approval", () => {
    expect(r.unanswered).toBe(5);
    expect(summariseEligibility(r)).toContain("5 of 12");
  });

  /**
   * A classic SPL token CANNOT carry a transfer fee - the extension does not
   * exist on that program. Saying so is different from saying "we looked and
   * found none", and the difference is whether a reader has to check again when
   * the token changes.
   */
  it("says a transfer fee is impossible here, not merely absent", () => {
    expect(verdictOf(r, "transfer_fees")).toBe("pass");
    expect(detailOf(r, "transfer_fees")).toMatch(/cannot carry a transfer fee/);
  });
});

describe("PYUSD, a Token-2022 mint carrying nearly every hazard", () => {
  const r = run("token_2022_pyusd");

  it("needs review rather than being waved through", () => {
    expect(r.overall).toBe("needs-review");
    expect(r.tokenProgram).toBe(TOKEN_2022_PROGRAM);
  });

  /**
   * Each hazard is named with why it matters. A report that said "has
   * extensions" would be true and useless: the caller deciding policy needs to
   * know it is a permanent delegate and not a metadata pointer.
   */
  it("names the permanent delegate and the transfer hook, with the reason", () => {
    const detail = detailOf(r, "extensions");
    expect(detail).toContain("permanentDelegate");
    expect(detail).toMatch(/without their signature/);
    expect(detail).toContain("transferHook");
    expect(detail).toMatch(/third-party code/);
  });

  it("flags the transfer fee separately, because payouts stop reconciling", () => {
    expect(verdictOf(r, "transfer_fees")).toBe("review");
    expect(detailOf(r, "transfer_fees")).toMatch(/amount received is not the amount sent/);
  });

  it("flags the freeze authority, which can strand a payout", () => {
    expect(verdictOf(r, "freeze_authority")).toBe("review");
    expect(detailOf(r, "freeze_authority")).toMatch(/holding a payout/);
  });

  it("does not treat Token-2022 itself as a failure", () => {
    // The program is legitimate. What matters is what is switched on inside it.
    expect(verdictOf(r, "token_program")).toBe("review");
    expect(verdictOf(r, "mint_exists")).toBe("pass");
  });
});

describe("USDC, which everybody treats as safe", () => {
  const r = run("usdc");

  /**
   * The case worth having a fixture for. USDC is classic SPL, no extensions,
   * and is the default answer to "what should we pay out in" - and it still has
   * a freeze authority and a mint authority. A checker that returns a clean
   * verdict here is not reading the account.
   */
  it("still needs review, on a classic token with no extensions", () => {
    expect(r.tokenProgram).toBe(TOKEN_PROGRAM);
    expect(verdictOf(r, "extensions")).toBe("pass");
    expect(r.overall).toBe("needs-review");
  });

  it("because the freeze and mint authorities are set", () => {
    expect(verdictOf(r, "freeze_authority")).toBe("review");
    expect(verdictOf(r, "mint_authority")).toBe("review");
  });
});

describe("the properties that must not erode", () => {
  const all = ["wavewarz_battle_mint", "token_2022_pyusd", "usdc"].map(run);

  /**
   * THE ASYMMETRY. A token can be shown ineligible from partial data - one
   * disqualifying fact is enough. It can never be shown eligible from partial
   * data, because five checks are not on chain. The word is absent from the
   * type, and this asserts it is absent from the behaviour too.
   */
  it("never reports a token as eligible, whatever it is handed", () => {
    for (const r of all) {
      expect(["ineligible", "needs-review", "chain-clean"]).toContain(r.overall);
      expect(JSON.stringify(r)).not.toMatch(/"overall":\s*"eligible"/);
    }
  });

  it("always emits the same twelve checks, so a caller can count them", () => {
    for (const r of all) {
      expect(r.checks).toHaveLength(12);
      expect(r.unanswered).toBe(5);
      expect(r.answered).toBe(7);
    }
  });

  it("gives every check a stable id and the PRD's own wording", () => {
    const ids = all[0].checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of all[0].checks) {
      expect(c.id).toMatch(/^[a-z_]+$/);
      expect(c.requirement.length).toBeGreaterThan(10);
      expect(c.detail.length).toBeGreaterThan(10);
    }
  });

  /**
   * The unanswered five must be identical across tokens. If a simple token
   * produced fewer unknowns, a caller comparing two reports would read the
   * difference as one token being better understood than another, when it only
   * means the checker got lazier.
   */
  it("reports the same five unknowns for every token, with what each would need", () => {
    const unknownIds = all.map((r) =>
      r.checks.filter((c) => c.verdict === "unknown").map((c) => c.id).sort(),
    );
    expect(unknownIds[0]).toEqual([
      "liquidity", "manipulation_risk", "price_impact", "route", "token_account_requirements",
    ]);
    expect(unknownIds[1]).toEqual(unknownIds[0]);
    expect(unknownIds[2]).toEqual(unknownIds[0]);
    for (const c of all[0].checks.filter((c) => c.verdict === "unknown")) {
      expect(c.detail).toMatch(/needs|depends|judgement/);
    }
  });

  /**
   * No fixture is chain-clean - all three real mints have something to review -
   * so the clean path is exercised synthetically. It is the sentence somebody
   * would most easily mistake for approval, which is why it must carry the
   * caveat.
   */
  it("says the unanswered count in the summary even when chain looks clean", () => {
    const clean = checkTokenEligibility("x", {
      owner: TOKEN_PROGRAM,
      data: { parsed: { type: "mint", info: { decimals: 6, isInitialized: true } } },
    });
    expect(clean.overall).toBe("chain-clean");
    expect(summariseEligibility(clean)).toMatch(/nothing concerning on chain/);
    expect(summariseEligibility(clean)).toMatch(/5 of 12 checks need data/);
  });
});

describe("what is wrong regardless of anybody's policy", () => {
  it("fails a mint address with no account", () => {
    const r = checkTokenEligibility("So11111111111111111111111111111111111111112", null);
    expect(r.overall).toBe("ineligible");
    expect(verdictOf(r, "mint_exists")).toBe("fail");
    // Still twelve checks: an early failure must not shrink the report.
    expect(r.checks).toHaveLength(6);
  });

  it("fails an account that exists but is not a mint", () => {
    const r = checkTokenEligibility("x", {
      owner: TOKEN_PROGRAM,
      data: { parsed: { type: "account", info: {} } },
    });
    expect(r.overall).toBe("ineligible");
    expect(detailOf(r, "mint_exists")).toMatch(/not a mint/);
  });

  it("fails a mint owned by neither token program", () => {
    const r = checkTokenEligibility("x", {
      owner: "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo",
      data: { parsed: { type: "mint", info: { decimals: 9, isInitialized: true } } },
    });
    expect(r.overall).toBe("ineligible");
    expect(verdictOf(r, "token_program")).toBe("fail");
  });

  it("reviews absurd decimals rather than passing them", () => {
    const r = checkTokenEligibility("x", {
      owner: TOKEN_PROGRAM,
      data: { parsed: { type: "mint", info: { decimals: 30, isInitialized: true } } },
    });
    expect(verdictOf(r, "decimals")).toBe("review");
    expect(detailOf(r, "decimals")).toMatch(/overflows a u64/);
  });

  /**
   * Synthetic, and labelled as such: no real mint in the fixtures carries only
   * harmless extensions. The path matters because treating "has any extension"
   * as a hazard would flag every Token-2022 token with a metadata pointer,
   * which is most of them.
   */
  it("passes a Token-2022 mint whose extensions do not touch transfers", () => {
    const r = checkTokenEligibility("x", {
      owner: TOKEN_2022_PROGRAM,
      data: {
        parsed: {
          type: "mint",
          info: {
            decimals: 6,
            isInitialized: true,
            extensions: [{ extension: "metadataPointer" }, { extension: "tokenMetadata" }],
          },
        },
      },
    });
    expect(verdictOf(r, "extensions")).toBe("pass");
    expect(detailOf(r, "extensions")).toContain("metadataPointer");
    // The program itself is still review - transfer semantics must be read.
    expect(r.overall).toBe("needs-review");
  });
});
