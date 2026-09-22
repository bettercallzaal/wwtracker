/**
 * The program's refusals, and which of them we have actually produced.
 *
 * The catalogue exists for a consumer on another stack: a failing simulation
 * returns `{"InstructionError":[2,{"Custom":6001}]}`, and a widget that renders
 * "custom program error: 0x1771" has told the person nothing.
 *
 * The tests that matter here are not the lookups. They are the two that keep
 * the file honest: that `observed` is only set where this lane really saw the
 * error, and that decoding degrades to something useful rather than throwing.
 */
import { describe, expect, it } from "vitest";
import {
  PROGRAM_ERRORS,
  decodeSimulationError,
  explainSimulationError,
  programError,
} from "../ww/errors";

describe("the catalogue", () => {
  it("carries all 28 IDL errors plus the Anchor ones a client hits", () => {
    const idl = PROGRAM_ERRORS.filter((e) => e.source === "idl");
    expect(idl).toHaveLength(28);
    expect(idl[0].code).toBe(6000);
    expect(idl[idl.length - 1].code).toBe(6027);
    // 3012 is not in the IDL and is the first error a new user meets.
    expect(programError(3012)?.name).toBe("AccountNotInitialized");
  });

  it("has no duplicate codes", () => {
    const codes = PROGRAM_ERRORS.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  /**
   * The column that separates this from a copy of the IDL. Four outcomes have
   * been produced against the deployed program by this lane; the rest are names
   * repeated from a file. If a future edit marks something observed, it has to
   * say how, so the claim can be checked.
   */
  it("marks exactly the errors this lane has produced, each with its evidence", () => {
    const observed = PROGRAM_ERRORS.filter((e) => e.observed);
    expect(observed.map((e) => e.code).sort((a, b) => a - b)).toEqual([3012, 6001, 6009]);
    for (const e of observed) {
      expect(e.observed).toMatch(/2026-09-1[78]/);
      expect(e.observed!.length).toBeGreaterThan(60);
    }
  });

  it("does not claim to have seen an error it has not", () => {
    // Slippage is declared and plausible and we have never triggered it.
    expect(programError(6014)?.name).toBe("SlippageExceeded");
    expect(programError(6014)?.observed).toBeUndefined();
  });
});

describe("decoding a simulation error", () => {
  it("reads the code and the instruction index, which matters as much", () => {
    // A first trade is compute budget, two ATA creations, then the buy: index 4.
    expect(decodeSimulationError({ InstructionError: [4, { Custom: 6001 }] })).toEqual({
      instructionIndex: 4,
      code: 6001,
    });
  });

  it("explains the three this lane has actually seen", () => {
    expect(explainSimulationError({ InstructionError: [2, { Custom: 6001 }] })).toBe(
      "Battle has already ended",
    );
    expect(explainSimulationError({ InstructionError: [2, { Custom: 6009 }] })).toBe(
      "Battle not ended",
    );
    expect(explainSimulationError({ InstructionError: [2, { Custom: 3012 }] })).toBe(
      "The program expected this account to be already initialized.",
    );
  });

  /**
   * The program's wording for a floor that held reads as a failure. Traders in
   * the finals Space on 2026-09-20 took "Slippage tolerance exceeded" for the
   * site being broken. The program's words stay first; the sentence after
   * them says what happened and what to do.
   */
  it("keeps the program's words and adds what a trader should do, for the two guards", () => {
    const slip = explainSimulationError({ InstructionError: [2, { Custom: 6014 }] });
    expect(slip.startsWith("Slippage tolerance exceeded. ")).toBe(true);
    expect(slip).toMatch(/floor did its job/);
    expect(slip).toMatch(/nothing was traded/i);
    const late = explainSimulationError({ InstructionError: [2, { Custom: 6013 }] });
    expect(late.startsWith("Transaction deadline exceeded. ")).toBe(true);
    expect(late).toMatch(/Nothing was traded/);
  });

  /**
   * An RPC can return a string, a shape from a newer runtime, or nothing.
   * Throwing in a widget over an unrecognised error shape turns a bad trade into
   * a broken page.
   */
  it("returns null rather than throwing on anything unrecognised", () => {
    for (const junk of [null, undefined, "BlockhashNotFound", {}, { InstructionError: [] }, { InstructionError: [0] }, { InstructionError: [0, "InvalidAccountData"] }, 42]) {
      expect(decodeSimulationError(junk)).toBeNull();
    }
  });

  it("names the raw code when it is not in the list, rather than saying nothing useful", () => {
    const msg = explainSimulationError({ InstructionError: [0, { Custom: 6031 }] });
    expect(msg).toContain("6031");
  });

  it("says plainly when it cannot decode at all", () => {
    expect(explainSimulationError("BlockhashNotFound")).toMatch(/no code this client recognises/);
  });
});
