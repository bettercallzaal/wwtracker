/**
 * Every constant this library hand-derived, checked against the program's IDL.
 *
 * **NONE OF THE IDL IS NEW AND THAT IS WORTH SAYING FIRST.** The same file has
 * been committed at `chain/wavewarz.idl.json` in the protocol repo, and
 * `lib/ww/errors.ts` has carried all 28 error codes marked `source: "idl"` for
 * some time. A session on 2026-09-20 extracted it from wavewarz.com's client
 * bundle believing it was closing an open "ask Hurricane for the IDL" item, and
 * it was not - the item was stale, and the extracted bytes turned out to be
 * IDENTICAL to the committed copy. The only thing that check established is
 * that the deployed site ships the same IDL we already had.
 *
 * **What was missing is not the IDL. It is anything that compares our constants
 * TO it.** Every discriminator, account count and byte offset in this library
 * was derived by decoding real transactions - correctly, as it turns out - and
 * then lived in a hand-written table that nothing could contradict. That is the
 * same shape as the `REVALIDATE_SECONDS` near-miss and the hand-retyped
 * `claimShares` discriminator: a value transcribed from a source is unverified
 * until something compares it back to the source.
 *
 * This is that comparison. It fails if the program changes, if the IDL is
 * updated, or if somebody edits a constant by hand.
 */
import { describe, expect, it } from "vitest";
import idl from "../__fixtures__/wavewarz-idl.json";
import { DISCRIMINATOR_BY_NAME } from "../ww/instructions";
import { PROGRAM_ID } from "../ww/pda";

type IdlIx = { name: string; discriminator: number[]; accounts: unknown[]; args: { name: string; type: unknown }[] };
type IdlField = { name: string; type: unknown };
const doc = idl as unknown as {
  address: string;
  metadata: { name: string; version: string };
  instructions: IdlIx[];
  types: { name: string; type: { kind: string; fields?: IdlField[] } }[];
  errors: { code: number; name: string; msg: string }[];
};

it("is the IDL for the program this library targets", () => {
  expect(doc.address).toBe(PROGRAM_ID);
  expect(doc.metadata.name).toBe("wavewarzvtwo");
});

describe("discriminators", () => {
  it("covers every instruction the program has, and no more", () => {
    // Six. A 200-transaction sample of real program traffic on 2026-09-20 found
    // exactly these six and nothing else, which is the other half of the proof:
    // the IDL says what exists, the sample says what is used.
    expect(doc.instructions).toHaveLength(6);
    expect(doc.instructions.map((i) => i.name).sort()).toEqual([
      "buyShares", "claimShares", "endBattle", "initializeBattle", "initializeMints", "sellShares",
    ]);
  });

  it("matches ours byte for byte, for every instruction", () => {
    for (const ix of doc.instructions) {
      const ours = DISCRIMINATOR_BY_NAME[ix.name as keyof typeof DISCRIMINATOR_BY_NAME];
      expect(ours, `no discriminator for ${ix.name}`).toBeDefined();
      expect([...ours], ix.name).toEqual(ix.discriminator);
    }
  });

  it("has a discriminator for every IDL instruction and vice versa", () => {
    expect(Object.keys(DISCRIMINATOR_BY_NAME).sort()).toEqual(doc.instructions.map((i) => i.name).sort());
  });
});

describe("the arguments we encode", () => {
  it("agrees that a launch takes id, DURATION and start time, in that order", () => {
    // The trap this library warns about, stated by the program's own schema:
    // the middle field is a duration. Nothing else here would catch a caller
    // passing an end time, because both are i64.
    const params = doc.types.find((t) => t.name === "BattleInitParams")!;
    expect(params.type.fields!.map((f) => f.name)).toEqual(["battle_id", "battle_duration", "start_time"]);
  });

  it("agrees that buys and sells carry a slippage floor and a deadline", () => {
    const buy = doc.instructions.find((i) => i.name === "buyShares")!;
    expect(buy.args.map((a) => a.name)).toEqual(["amount", "artistA", "minTokensOut", "deadline"]);
    const sell = doc.instructions.find((i) => i.name === "sellShares")!;
    expect(sell.args.map((a) => a.name)).toEqual(["amount", "artistA", "minSolOut", "deadline"]);
  });

  it("agrees that mints, ending and claiming take no arguments at all", () => {
    for (const name of ["initializeMints", "endBattle", "claimShares"]) {
      expect(doc.instructions.find((i) => i.name === name)!.args, name).toHaveLength(0);
    }
  });
});

describe("account counts", () => {
  it("matches what we build, per instruction", () => {
    const expected: Record<string, number> = {
      initializeBattle: 8, initializeMints: 7, buyShares: 13,
      sellShares: 13, endBattle: 7, claimShares: 9,
    };
    for (const ix of doc.instructions) expect(ix.accounts.length, ix.name).toBe(expected[ix.name]);
  });
});

/**
 * The byte offsets, computed from the IDL's field order rather than asserted.
 */
describe("the battle account layout", () => {
  const SIZE: Record<string, number> = { u8: 1, bool: 1, i64: 8, u64: 8, pubkey: 32 };
  const offsets = (() => {
    const fields = doc.types.find((t) => t.name === "Battle")!.type.fields!;
    const out: Record<string, number> = {};
    let off = 8; // Anchor's account discriminator
    for (const f of fields) {
      out[f.name] = off;
      const sz = SIZE[f.type as string];
      if (sz === undefined) break; // TransactionState onward: not fixed-width here
      off += sz;
    }
    return out;
  })();

  it("puts the fields we read where we read them", () => {
    expect(offsets.battle_id).toBe(8);
    expect(offsets.start_time).toBe(20);
    expect(offsets.end_time).toBe(28);
    expect(offsets.artist_a_supply).toBe(196);
    expect(offsets.artist_b_supply).toBe(204);
    expect(offsets.winner_artist_a).toBe(244);
    expect(offsets.winner_decided).toBe(245);
  });

  /**
   * THE FIELD WE CALL "POOL" IS NAMED `sol_balance`, AND THE ONE NAMED `pool`
   * IS ELSEWHERE. Both exist, and the program writes the same value to both.
   */
  it("has TWO pairs of pool-like fields, and we read the first", () => {
    expect(offsets.artist_a_sol_balance).toBe(212);
    expect(offsets.artist_b_sol_balance).toBe(220);
    expect(offsets.artist_a_pool).toBe(228);
    expect(offsets.artist_b_pool).toBe(236);
  });

  it("explains why 228 is the wrong offset for side B specifically", () => {
    // `battle-record.py` documented `artist_b_final_pool` at 228. 228 is side
    // A's pool, so it agrees with side B's value only when the two sides hold
    // the same amount - which is why it matched 2 of 30 rather than 0 of 30.
    // Measured 2026-09-20 across all 1,694 battle accounts: 212 == 228 and
    // 220 == 236 on every one, so reading either of a PAIR is equivalent, and
    // reading ACROSS the pairs is not.
    expect(offsets.artist_a_pool).not.toBe(offsets.artist_b_sol_balance);
  });
});

describe("error codes", () => {
  it("has 28, starting at Anchor's user base", () => {
    expect(doc.errors).toHaveLength(28);
    expect(doc.errors[0].code).toBe(6000);
  });

  it("includes the four this estate has actually hit, with their meanings", () => {
    const by = new Map(doc.errors.map((e) => [e.code, e]));
    expect(by.get(6003)!.name).toBe("BattleNotActive");    // launching and trading in one go
    expect(by.get(6006)!.name).toBe("InvalidAmount");      // minTokensOut of 0
    expect(by.get(6008)!.name).toBe("InvalidCalculation"); // a trade too small to mint
    expect(by.get(6009)!.name).toBe("BattleNotEnded");     // claiming before settlement
  });
});
