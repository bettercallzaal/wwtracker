/**
 * The slippage floor rule, asserted against the PROGRAM rather than against our
 * guard.
 *
 * **THIS FILE EXISTS BECAUSE ITS ABSENCE SHIPPED A BUG.** On 2026-09-20 a buy
 * with `minTokensOut: 0` was measured failing with `InvalidAmount`, and the
 * rule was then written for buys AND sells because the two arguments look
 * symmetric - same position, same type, adjacent in the IDL. Sells accept zero.
 * For about an hour this library refused to build a transaction the chain
 * accepts, and the live client depends on exactly that: 31 of 31 sampled sells
 * carry `minSolOut: 0`.
 *
 * **All 1,011 tests passed throughout**, because the test asserted that our
 * guard refused what our guard said it refused. A test of a rule against the
 * same rule is green by construction, and its greenness means nothing about the
 * chain.
 *
 * So the fixture below is the program's four answers, captured by simulation
 * with the floor byte overwritten AFTER our guard runs - so our own validation
 * cannot mask what the program would say. If the program ever changes, or if
 * somebody widens the guard to sells again, this fails.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-slippage-floor.json";
import { buySharesInstruction, sellSharesInstruction } from "../ww/instructions";

type Case = { kind: "buy" | "sell"; field: string; floor: number; err: unknown; errorName: string | null };
const cases = (fixture as unknown as { cases: Case[] }).cases;
const find = (kind: string, floor: number) => cases.find((c) => c.kind === kind && c.floor === floor)!;

const common = {
  battleId: 1_749_170_107,
  trader: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
  battle: {
    artistA: "ASpsqT7qKbHF7VhsBPYGRk95vNyAgPuhTBoh2o7ptRLb",
    artistB: "BYshzR3KeycopC1o7iynYp224AM3psAUziV35Nyha8Ns",
    wavewarzWallet: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
  },
  artistA: true,
  deadline: 1,
};

it("captured all four combinations, so no case below is missing by accident", () => {
  expect(cases).toHaveLength(4);
  for (const kind of ["buy", "sell"]) for (const floor of [0, 1]) expect(find(kind, floor)).toBeDefined();
});

describe("what the program does", () => {
  it("REJECTS a buy floor of zero, with InvalidAmount", () => {
    expect(find("buy", 0).err).not.toBeNull();
    expect(find("buy", 0).errorName).toBe("InvalidAmount");
  });

  it("ACCEPTS a sell floor of zero", () => {
    // The asymmetry. Not a guess about the program; the program's own answer.
    expect(find("sell", 0).err).toBeNull();
  });

  it("accepts a floor of one on both sides", () => {
    expect(find("buy", 1).err).toBeNull();
    expect(find("sell", 1).err).toBeNull();
  });
});

describe("what we build, checked against those answers", () => {
  it("refuses exactly what the program refuses", () => {
    const programRefusesBuyZero = find("buy", 0).err !== null;
    const attempt = () => buySharesInstruction({ ...common, amountLamports: 1_000_000, minTokensOut: 0 });
    if (programRefusesBuyZero) expect(attempt).toThrow(/InvalidAmount/);
    else expect(attempt).not.toThrow();
  });

  it("allows exactly what the program allows", () => {
    // The assertion that would have failed the shipped bug on the day.
    const programAllowsSellZero = find("sell", 0).err === null;
    const attempt = () => sellSharesInstruction({ ...common, amountTokens: 100_000, minSolOut: 0 });
    if (programAllowsSellZero) expect(attempt).not.toThrow();
    else expect(attempt).toThrow();
  });

  it("never refuses a floor the program accepts, for any captured case", () => {
    // The general form, so a future guard cannot be tightened past the chain.
    for (const c of cases) {
      const build = () =>
        c.kind === "buy"
          ? buySharesInstruction({ ...common, amountLamports: 1_000_000, minTokensOut: c.floor })
          : sellSharesInstruction({ ...common, amountTokens: 100_000, minSolOut: c.floor });
      if (c.err === null) expect(build, `${c.kind} floor ${c.floor} is accepted on chain`).not.toThrow();
    }
  });
});
