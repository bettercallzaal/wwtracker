/**
 * The message serializer, against a real mainnet transaction's own bytes.
 *
 * The round-trip is the load-bearing control: parse the 700 bytes that actually
 * settled on chain, re-serialize them, require the result to be identical. That
 * exercises compact-u16, the header arithmetic, account indices and field order
 * against something this code did not produce.
 *
 * What it deliberately does NOT assert is that `serializeMessage` chooses the
 * same account ORDER as that transaction's client. It does not, and Solana has
 * no canonical order - the header declares the group sizes and instructions
 * address accounts by index, so any self-consistent order is valid. The fixture's
 * own order is not sortable (writable accounts happen to be in base58 order,
 * readonly ones are not), so matching it would mean copying one library's
 * internals and calling that correctness. Instead, the compiled output is checked
 * for the properties the runtime actually requires.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-buy-transaction-message.json";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";
import {
  COMPUTE_BUDGET_PROGRAM_ID,
  compileAccounts,
  computeUnitLimitInstruction,
  computeUnitPriceInstruction,
  decodeCompactU16,
  encodeCompactU16,
  parseMessage,
  reserializeMessage,
  serializeMessage,
} from "../ww/message";
import { battleAccountsFromRaw, buySharesInstruction } from "../ww/instructions";
import { PROGRAM_ID } from "../ww/pda";

const raw = new Uint8Array(Buffer.from(fixture.message_base64, "base64"));
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

describe("compact-u16", () => {
  it("matches the spec at the boundaries where the byte count changes", () => {
    expect([...encodeCompactU16(0)]).toEqual([0]);
    expect([...encodeCompactU16(127)]).toEqual([127]);
    expect([...encodeCompactU16(128)]).toEqual([0x80, 0x01]);
    expect([...encodeCompactU16(16383)]).toEqual([0xff, 0x7f]);
    expect([...encodeCompactU16(16384)]).toEqual([0x80, 0x80, 0x01]);
  });

  it("round-trips every value that could plausibly appear", () => {
    for (const n of [0, 1, 12, 16, 127, 128, 255, 700, 1232, 16383, 16384, 65535]) {
      const [got, at] = decodeCompactU16(encodeCompactU16(n), 0);
      expect(got).toBe(n);
      expect(at).toBe(encodeCompactU16(n).length);
    }
  });

  it("refuses a value it cannot encode rather than truncating it", () => {
    expect(() => encodeCompactU16(65536)).toThrow(/out of range/);
    expect(() => encodeCompactU16(-1)).toThrow(/out of range/);
  });

  /**
   * `bytes[i]` past the end is `undefined`, and `undefined & 0x7f` is 0 - so an
   * unguarded decoder terminates cleanly on a truncated buffer and returns a
   * wrong-but-plausible length that the caller then trusts. Silently succeeding
   * on malformed input is the wrong failure mode for a parser whose output a
   * person is asked to approve.
   */
  it("throws when the length prefix runs past the end of the buffer", () => {
    expect(() => decodeCompactU16(Uint8Array.from([0x80]), 0)).toThrow(/past the end/);
    expect(() => decodeCompactU16(new Uint8Array(0), 0)).toThrow(/past the end/);
    expect(() => decodeCompactU16(Uint8Array.from([0x01, 0x80]), 1)).toThrow(
      /past the end/,
    );
  });

  it("refuses a continuation longer than compact-u16 allows", () => {
    expect(() => decodeCompactU16(Uint8Array.from([0x80, 0x80, 0x80, 0x01]), 0)).toThrow(
      /longer than three bytes/,
    );
  });

  it("propagates the error up through parseMessage on a truncated message", () => {
    expect(() => parseMessage(raw.slice(0, 3))).toThrow(/past the end/);
  });
});

describe("parsing the real transaction", () => {
  const m = parseMessage(raw);

  it("reads the header, payer and blockhash that settled on chain", () => {
    expect(m.payer).toBe(fixture.expected.payer);
    expect(m.recentBlockhash).toBe(fixture.expected.recent_blockhash);
    expect(m.accounts.length).toBe(fixture.expected.num_accounts);
    expect(m.instructions.length).toBe(fixture.expected.num_instructions);
    expect(m.accounts.filter((a) => a.isSigner).length).toBe(
      fixture.expected.num_signatures,
    );
    expect(m.accounts.filter((a) => !a.isSigner && !a.isWritable).length).toBe(
      fixture.expected.num_readonly_unsigned,
    );
  });

  it("finds our buy at index 2, with the bytes the other fixture recorded", () => {
    const ours = m.instructions[fixture.expected.our_instruction_index];
    expect(ours.programId).toBe(PROGRAM_ID);
    expect(hex(ours.data)).toBe(buyFixture.instruction_data_hex);
    expect(ours.keys.map((k) => k.pubkey)).toEqual(buyFixture.accounts_in_order);
  });

  it("finds the two ComputeBudget instructions, and our encoders reproduce them", () => {
    const [limit, price] = m.instructions;
    expect(limit.programId).toBe(COMPUTE_BUDGET_PROGRAM_ID);
    expect(price.programId).toBe(COMPUTE_BUDGET_PROGRAM_ID);
    expect(hex(limit.data)).toBe(
      hex(computeUnitLimitInstruction(fixture.expected.compute_unit_limit).data),
    );
    expect(hex(price.data)).toBe(
      hex(
        computeUnitPriceInstruction(fixture.expected.compute_unit_price_micro_lamports)
          .data,
      ),
    );
  });

  it("refuses a message with trailing bytes rather than ignoring them", () => {
    expect(() => parseMessage(Uint8Array.from([...raw, 0]))).toThrow(/trailing/);
  });
});

describe("the round trip is byte-identical", () => {
  it("re-serializes the real message to exactly the bytes it came from", () => {
    expect(hex(reserializeMessage(parseMessage(raw)))).toBe(hex(raw));
  });

  it("would notice a single changed byte - the control for the control", () => {
    const tampered = Uint8Array.from(raw);
    tampered[tampered.length - 1] ^= 0x01;
    expect(hex(reserializeMessage(parseMessage(tampered)))).not.toBe(hex(raw));
  });
});

describe("compiling a message we build ourselves", () => {
  const battleRaw = new Uint8Array(
    Buffer.from(buyFixture.battle_account_base64, "base64"),
  );
  const battle = battleAccountsFromRaw(battleRaw);
  const trader = buyFixture.accounts_in_order[5];
  const buy = buySharesInstruction({
    battleId: buyFixture.battle_id,
    trader,
    battle,
    artistA: false,
    amountLamports: 30_000_000,
    minTokensOut: 5_586_000,
    deadline: 1784505909,
  });
  const instructions = [
    computeUnitLimitInstruction(200_000),
    computeUnitPriceInstruction(375_000),
    buy,
  ];
  const blockhash = fixture.expected.recent_blockhash;

  it("puts the payer first and makes it the only signer", () => {
    const accounts = compileAccounts(trader, instructions);
    expect(accounts[0].pubkey).toBe(trader);
    expect(accounts[0].isSigner).toBe(true);
    expect(accounts[0].isWritable).toBe(true);
    expect(accounts.filter((a) => a.isSigner)).toHaveLength(1);
  });

  it("includes every account and every program exactly once", () => {
    const accounts = compileAccounts(trader, instructions);
    const seen = accounts.map((a) => a.pubkey);
    expect(new Set(seen).size).toBe(seen.length);
    for (const a of buy.keys) expect(seen).toContain(a.pubkey);
    expect(seen).toContain(PROGRAM_ID);
    expect(seen).toContain(COMPUTE_BUDGET_PROGRAM_ID);
  });

  it("groups accounts so the header the runtime reads is true", () => {
    const accounts = compileAccounts(trader, instructions);
    // writable signers, then readonly signers, then writable, then readonly -
    // the order the three header counts describe.
    const rank = (a: { isSigner: boolean; isWritable: boolean }) =>
      a.isSigner ? (a.isWritable ? 0 : 1) : a.isWritable ? 2 : 3;
    const ranks = accounts.map(rank);
    expect([...ranks].sort((x, y) => x - y)).toEqual(ranks);
  });

  /**
   * No WaveWarZ instruction has a readonly signer - buy, sell and claim each
   * have exactly one signer and it pays, so it is writable. That means the real
   * inputs leave two of the four account groups empty, and a test built only
   * from them passes however the groups are ordered: measured, swapping the
   * readonly-signer and writable-nonsigner groups broke nothing. The ordering
   * would be wrong and silent the first time a co-signer appeared.
   *
   * So the case is constructed rather than found, which is the only way to have
   * it: all four groups non-empty, and the header the runtime reads must still
   * describe the list it is attached to.
   */
  it("orders all four account groups correctly, including readonly signers", () => {
    const cosigner = "SysvarRent111111111111111111111111111111111";
    const readonlyPlain = "SysvarC1ock11111111111111111111111111111111";
    const synthetic = {
      programId: PROGRAM_ID,
      keys: [
        { pubkey: cosigner, isSigner: true, isWritable: false },
        { pubkey: readonlyPlain, isSigner: false, isWritable: false },
        { pubkey: buyFixture.accounts_in_order[1], isSigner: false, isWritable: true },
      ],
      data: new Uint8Array([7]),
    };
    const accounts = compileAccounts(trader, [synthetic]);

    const kinds = accounts.map((a) =>
      a.isSigner ? (a.isWritable ? "WS" : "rS") : a.isWritable ? "W" : "r",
    );
    expect(kinds).toContain("WS");
    expect(kinds).toContain("rS");
    expect(kinds).toContain("W");
    expect(kinds).toContain("r");
    expect(kinds.indexOf("rS")).toBeGreaterThan(kinds.lastIndexOf("WS"));
    expect(kinds.indexOf("W")).toBeGreaterThan(kinds.lastIndexOf("rS"));
    expect(kinds.indexOf("r")).toBeGreaterThan(kinds.lastIndexOf("W"));

    // And the header must still describe this list after a round trip.
    const back = parseMessage(serializeMessage(trader, blockhash, [synthetic]));
    expect(back.accounts.map((a) => a.pubkey)).toEqual(accounts.map((a) => a.pubkey));
    expect(back.accounts.map((a) => [a.isSigner, a.isWritable])).toEqual(
      accounts.map((a) => [a.isSigner, a.isWritable]),
    );
  });

  /**
   * The dedup merge takes the strongest flags, never the latest. No fixture can
   * show this: every real WaveWarZ instruction is flag-consistent per account,
   * so the merge only ever runs in the trivial case where both sides agree, and
   * `&&=` or last-write-wins would pass the whole suite. Same shape as the
   * four-group bug in this file - a branch no real input reaches - and found the
   * same way, by asking rather than by a test going red.
   *
   * It matters at runtime: an account marked readonly because the readonly
   * instruction was compiled last makes the instruction that writes it fail.
   */
  it("merges conflicting flags for one account by taking the strongest", () => {
    const shared = buyFixture.accounts_in_order[1];
    const writesIt = {
      programId: PROGRAM_ID,
      keys: [{ pubkey: shared, isSigner: false, isWritable: true }],
      data: new Uint8Array([1]),
    };
    const readsIt = {
      programId: PROGRAM_ID,
      keys: [{ pubkey: shared, isSigner: false, isWritable: false }],
      data: new Uint8Array([2]),
    };

    for (const order of [
      [writesIt, readsIt],
      [readsIt, writesIt], // the order that last-write-wins would get wrong
    ]) {
      const account = compileAccounts(trader, order).find((a) => a.pubkey === shared)!;
      expect(account.isWritable).toBe(true);
    }

    // Same for the signer flag, and it must survive into the serialized header.
    const signsIt = {
      programId: PROGRAM_ID,
      keys: [{ pubkey: shared, isSigner: true, isWritable: false }],
      data: new Uint8Array([3]),
    };
    const compiled = compileAccounts(trader, [readsIt, signsIt]).find(
      (a) => a.pubkey === shared,
    )!;
    expect(compiled.isSigner).toBe(true);

    const back = parseMessage(serializeMessage(trader, blockhash, [readsIt, signsIt]));
    const roundTripped = back.accounts.find((a) => a.pubkey === shared)!;
    expect(roundTripped.isSigner).toBe(true);
    // Both instructions must still point at that one account, not two entries.
    expect(back.accounts.filter((a) => a.pubkey === shared)).toHaveLength(1);
    expect(back.instructions.every((ix) => ix.keys[0].pubkey === shared)).toBe(true);
  });

  it("never marks a program id writable or signing", () => {
    const accounts = compileAccounts(trader, instructions);
    for (const id of [PROGRAM_ID, COMPUTE_BUDGET_PROGRAM_ID]) {
      const a = accounts.find((x) => x.pubkey === id)!;
      expect(a.isWritable).toBe(false);
      expect(a.isSigner).toBe(false);
    }
  });

  it("produces a message that parses back to what went in", () => {
    const bytes = serializeMessage(trader, blockhash, instructions);
    const back = parseMessage(bytes);
    expect(back.payer).toBe(trader);
    expect(back.recentBlockhash).toBe(blockhash);
    expect(back.instructions).toHaveLength(3);
    const ours = back.instructions[2];
    expect(ours.programId).toBe(PROGRAM_ID);
    expect(hex(ours.data)).toBe(buyFixture.instruction_data_hex);
    // The accounts our instruction addresses must survive the index round trip
    // in order - this is what a wrong index would break.
    expect(ours.keys.map((k) => k.pubkey)).toEqual(buyFixture.accounts_in_order);
  });

  it("fits in one packet with room to spare, before the wallet adds its guards", () => {
    const bytes = serializeMessage(trader, blockhash, instructions);
    // 1232 is the transaction size limit; signatures and Phantom's Lighthouse
    // instructions are added after this, so the margin is the point.
    expect(bytes.length).toBeLessThan(700);
  });

  it("collects accounts it has no special knowledge of, such as sysvars", () => {
    const withSysvar = {
      programId: PROGRAM_ID,
      keys: [
        {
          pubkey: "SysvarRent111111111111111111111111111111111",
          isSigner: false,
          isWritable: false,
        },
      ],
      data: new Uint8Array([1]),
    };
    const accounts = compileAccounts(trader, [withSysvar]);
    expect(accounts.map((a) => a.pubkey)).toContain(
      "SysvarRent111111111111111111111111111111111",
    );
    // and it survives a serialize/parse round trip at the right index
    const back = parseMessage(serializeMessage(trader, blockhash, [withSysvar]));
    expect(back.instructions[0].keys[0].pubkey).toBe(
      "SysvarRent111111111111111111111111111111111",
    );
  });
});
