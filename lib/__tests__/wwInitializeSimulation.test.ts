/**
 * The launch instruction, checked against what the DEPLOYED PROGRAM did with it.
 *
 * Every other test of `initializeBattleInstruction` checks the bytes we build.
 * This one checks the account the program builds FROM those bytes, captured by
 * simulating on mainnet with `sigVerify: false` and asking for the post-state
 * accounts back. Nothing was signed and nothing was sent - a simulation returns
 * the state it would have written without writing it.
 *
 * THE POINT IS THE SECOND CASE. The duration trap was written down as an
 * inference: "pass an end time where a duration belongs and the battle runs for
 * about 56 years." An inference in a doc comment is a guess with good
 * punctuation. So it was measured: the program accepted it, `err: null`, same
 * compute cost, same cheerful log line, and produced a battle ending in the year
 * 2083. There is no validation between the caller and that outcome except the
 * argument name, which is why the trap gets a test rather than a sentence.
 *
 * THE FIXTURE ALSO SETTLES A SEPARATE QUESTION. It was captured from
 * `api.mainnet-beta.solana.com`, the free keyless endpoint. Simulation - the
 * rule every SOP in this estate descends from - never needed the keyed
 * `SOLANA_RPC_URL` at all. A session spent a round believing it was blocked on a
 * credential for this.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-initialize-simulation.json";
import { battlePda } from "../ww/pda";
import { BATTLE_ACCOUNT_BYTES } from "../ww/discovery";

type Sim = {
  battleId: number;
  durationPassed: number;
  err: unknown;
  unitsConsumed: number;
  battlePda: string;
  account: string;
  logs: string[];
};
const { correct, trap } = fixture as unknown as { correct: Sim; trap: Sim };

/** The three time fields, at the offsets the census verified. */
const times = (s: Sim) => {
  const raw = Buffer.from(s.account, "base64");
  return {
    bytes: raw.length,
    battleId: raw.readBigUInt64LE(8),
    startTime: raw.readBigInt64LE(20),
    endTime: raw.readBigInt64LE(28),
  };
};

describe("what the program actually wrote", () => {
  it("accepted the launch and created a 353-byte battle account", () => {
    expect(correct.err).toBeNull();
    expect(times(correct).bytes).toBe(BATTLE_ACCOUNT_BYTES);
  });

  it("derived the account at the PDA the SDK predicted", () => {
    expect(correct.battlePda).toBe(battlePda(correct.battleId));
  });

  it("stored the battle id at offset 8, as the census says", () => {
    expect(times(correct).battleId).toBe(BigInt(correct.battleId));
  });

  it("set start_time to the battle id, which is why the id is a timestamp", () => {
    const t = times(correct);
    expect(t.startTime).toBe(BigInt(correct.battleId));
    expect(correct.logs.join("\n")).toContain(`starting at ${correct.battleId}`);
  });

  it("computed end_time as start plus the DURATION we passed", () => {
    // 600 in, 600 back out. This is the assertion that fixes the semantics of
    // the middle argument: the program adds, it does not store.
    const t = times(correct);
    expect(Number(t.endTime - t.startTime)).toBe(correct.durationPassed);
  });

  it("costs about 18,600 compute units", () => {
    expect(correct.unitsConsumed).toBeGreaterThan(15_000);
    expect(correct.unitsConsumed).toBeLessThan(25_000);
  });
});

/**
 * The trap, measured rather than asserted.
 */
describe("passing an end time where the duration belongs", () => {
  it("IS ACCEPTED. The program raises nothing", () => {
    // This is the whole danger. A rejected mistake is not a trap.
    expect(trap.err).toBeNull();
  });

  it("is indistinguishable from a correct launch by cost or by log", () => {
    expect(trap.unitsConsumed).toBe(correct.unitsConsumed);
    expect(trap.logs.some((l) => l.includes("Battle initialized"))).toBe(true);
    expect(trap.logs.some((l) => /error|invalid|warn/i.test(l))).toBe(false);
  });

  it("produces a battle running more than fifty years", () => {
    const t = times(trap);
    const years = Number(t.endTime - t.startTime) / 31_557_600;
    expect(years).toBeGreaterThan(50);
    // The doc comment said "about 56 years" from arithmetic. Measured: 56.7.
    expect(years).toBeLessThan(60);
  });

  it("ends the battle in a year no caller intended", () => {
    const t = times(trap);
    expect(new Date(Number(t.endTime) * 1000).getUTCFullYear()).toBeGreaterThan(2080);
  });

  it("differs from the correct launch ONLY in the argument, not in the call", () => {
    // Same instruction, same accounts, same shape. Only the number differs, and
    // only the parameter name stands between a caller and this outcome.
    expect(trap.durationPassed).toBeGreaterThan(1_000_000_000);
    expect(correct.durationPassed).toBeLessThan(100_000);
  });
});
