/**
 * The token accounts a trader's FIRST trade in a battle has to create.
 *
 * This file exists because the other fixtures could not have produced it.
 * `ww-buy-transaction.json` is a real mainnet buy from a trader who had already
 * traded that battle, so his token accounts existed and his transaction contains
 * no account creation at all. Every test in the suite passed, the builder
 * reproduced that transaction byte for byte, and the first wallet that had never
 * touched the battle got "The program expected this account to be already
 * initialized" after 9,732 compute units.
 *
 * So the control here is a DIFFERENT real transaction - one captured from a
 * first-time trader (`ww-ata-create-transaction.json`) - and the property under
 * test is the one the old fixture was silent about: the six accounts of an
 * associated-token-account creation, in order.
 *
 * WHAT THIS FILE CANNOT PROVE, stated because the last gap of this shape was
 * invisible for six PRs. The fixture's instructions are plain `Create`, with an
 * empty data field; the builder emits `CreateIdempotent`, whose data is `0x01`.
 * No fixture in this repo contains a `CreateIdempotent`, so that one byte is
 * asserted here only as being deliberately different. It is verified by asking
 * the deployed ATA program, which is what a simulation does.
 */
import { describe, expect, it } from "vitest";
import ataFixture from "../__fixtures__/ww-ata-create-transaction.json";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";
import {
  battleAccountsFromRaw,
  buySharesInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  deadlineIn,
  traderTokenAccountInstructions,
} from "../ww/instructions";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  mintPda,
} from "../ww/pda";
import { compileAccounts } from "../ww/message";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const pubkeys = (ix: { keys: Array<{ pubkey: string }> }) => ix.keys.map((k) => k.pubkey);

const firstTrader = ataFixture.fee_payer;
const battleId = ataFixture.battle_id;

describe("the fixture is the transaction it claims to be", () => {
  /**
   * Checked before it is trusted. A fixture that named a different battle, or a
   * transaction whose two ATA creations were for unrelated mints, would make
   * every assertion below pass against the wrong thing.
   */
  it("creates the token accounts for THIS battle's two mints", () => {
    expect(ataFixture.ata_instructions[0].accounts_in_order[3]).toBe(mintPda(battleId, "a"));
    expect(ataFixture.ata_instructions[1].accounts_in_order[3]).toBe(mintPda(battleId, "b"));
  });

  it("creates them BEFORE the trade, in the same transaction", () => {
    for (const i of ataFixture.ata_instruction_indexes) {
      expect(i).toBeLessThan(ataFixture.wavewarz_instruction_index);
    }
  });

  /**
   * The fixture's own trader is not the fixture buy's trader. If they were the
   * same wallet this file would be testing the same starting state twice, which
   * is the defect it exists to close.
   */
  it("comes from a different trader than the buy fixture", () => {
    expect(firstTrader).not.toBe(buyFixture.accounts_in_order[5]);
  });
});

describe("createAssociatedTokenAccountIdempotentInstruction", () => {
  it("reproduces both of the real transaction's account lists, in order", () => {
    ataFixture.ata_instructions.forEach((real, i) => {
      const ours = createAssociatedTokenAccountIdempotentInstruction({
        funder: firstTrader,
        owner: firstTrader,
        mint: real.accounts_in_order[3],
      });
      expect(ours.programId).toBe(real.program_id);
      expect(pubkeys(ours), `instruction ${i}`).toEqual(real.accounts_in_order);
    });
  });

  it("derives the token account rather than being told it", () => {
    const mint = mintPda(battleId, "a");
    const ours = createAssociatedTokenAccountIdempotentInstruction({
      funder: firstTrader,
      owner: firstTrader,
      mint,
    });
    // Account 1 is the thing being created, and the fixture says what it is.
    expect(ours.keys[1].pubkey).toBe(associatedTokenAddress(firstTrader, mint));
    expect(ours.keys[1].pubkey).toBe(ataFixture.ata_instructions[0].accounts_in_order[1]);
  });

  /**
   * The flags are not in the fixture and cannot be: an account's writable and
   * signer bits are message-level, unioned across every instruction, so the
   * chain transaction shows the mint as writable only because its buy needs it.
   * They are pinned here instead, at the instruction level, where the ATA
   * program actually reads them.
   */
  it("marks the funder as the only signer and only two accounts writable", () => {
    const ours = createAssociatedTokenAccountIdempotentInstruction({
      funder: firstTrader,
      owner: firstTrader,
      mint: mintPda(battleId, "a"),
    });
    expect(ours.keys.map((k) => [k.isSigner, k.isWritable])).toEqual([
      [true, true], // funder pays rent
      [false, true], // the account being created
      [false, false], // owner
      [false, false], // mint
      [false, false], // system program
      [false, false], // token program
    ]);
    expect(ours.keys[4].pubkey).toBe(SYSTEM_PROGRAM_ID);
    expect(ours.keys[5].pubkey).toBe(TOKEN_PROGRAM_ID);
    expect(ours.programId).toBe(ASSOCIATED_TOKEN_PROGRAM_ID);
  });

  it("is the idempotent variant, which is the one byte that differs from chain", () => {
    const ours = createAssociatedTokenAccountIdempotentInstruction({
      funder: firstTrader,
      owner: firstTrader,
      mint: mintPda(battleId, "a"),
    });
    expect(hex(ours.data)).toBe("01");
    // And the difference is against a real `Create`, so nobody later "fixes"
    // one to match the other without reading why.
    expect(ataFixture.ata_instructions[0].data_hex).toBe("");
  });

  it("separates funder from owner, so the pair is not accidentally one field", () => {
    const mint = mintPda(battleId, "a");
    const other = buyFixture.accounts_in_order[5];
    const ours = createAssociatedTokenAccountIdempotentInstruction({
      funder: firstTrader,
      owner: other,
      mint,
    });
    expect(ours.keys[0].pubkey).toBe(firstTrader);
    expect(ours.keys[2].pubkey).toBe(other);
    // The created account belongs to the OWNER, not whoever paid for it.
    expect(ours.keys[1].pubkey).toBe(associatedTokenAddress(other, mint));
  });
});

describe("traderTokenAccountInstructions", () => {
  it("creates both sides, in the order chain uses", () => {
    const ixs = traderTokenAccountInstructions(battleId, firstTrader);
    expect(ixs).toHaveLength(2);
    expect(ixs[0].keys[3].pubkey).toBe(mintPda(battleId, "a"));
    expect(ixs[1].keys[3].pubkey).toBe(mintPda(battleId, "b"));
    ixs.forEach((ix, i) => {
      expect(pubkeys(ix)).toEqual(ataFixture.ata_instructions[i].accounts_in_order);
    });
  });

  /**
   * THE RED CONTROL FOR THE ORIGINAL BUG. Creating only the side being bought
   * leaves the other token account missing, and `buyShares` names both whichever
   * side is traded - so a one-sided fix would fail in exactly the same way, on
   * the same error, for the same reason.
   */
  it("covers both of the accounts a buy requires, not just the side being bought", () => {
    const battle = battleAccountsFromRaw(
      new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64")),
    );
    const buy = buySharesInstruction({
      battleId,
      trader: firstTrader,
      battle,
      artistA: true, // buying A still touches B's token account
      amountLamports: 10_000_000,
      minTokensOut: 1,
      deadline: deadlineIn(90),
    });
    const created = new Set(traderTokenAccountInstructions(battleId, firstTrader).map((i) => i.keys[1].pubkey));
    expect(created.has(buy.keys[3].pubkey)).toBe(true);
    expect(created.has(buy.keys[4].pubkey)).toBe(true);
  });
});

describe("prepending the creations does not disturb the trade", () => {
  /**
   * Every account an ATA creation names is already in the buy: the trader signs
   * and pays, both token accounts and both mints are already writable, and both
   * programs are already there. So the compiled account list must be IDENTICAL
   * with and without them.
   *
   * This is the assertion that would catch a silent break. Solana instructions
   * address accounts by index into one shared list; if prepending changed that
   * list, every index in the buy would shift and the trade would execute against
   * the wrong accounts while still looking well-formed.
   */
  it("leaves the compiled account list byte-for-byte the same", () => {
    const battle = battleAccountsFromRaw(
      new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64")),
    );
    const buy = buySharesInstruction({
      battleId,
      trader: firstTrader,
      battle,
      artistA: true,
      amountLamports: 10_000_000,
      minTokensOut: 1,
      deadline: deadlineIn(90),
    });
    const without = compileAccounts(firstTrader, [buy]);
    const with_ = compileAccounts(firstTrader, [
      ...traderTokenAccountInstructions(battleId, firstTrader),
      buy,
    ]);
    expect(with_).toEqual(without);
    // Named explicitly so a reader knows the ATA program was already there and
    // this is not passing because the comparison is vacuous.
    expect(without.map((a) => a.pubkey)).toContain(ASSOCIATED_TOKEN_PROGRAM_ID);
    // The buy's thirteen accounts plus the WaveWarZ program id itself, which
    // `compileAccounts` adds because an instruction addresses its program by
    // index too. Fourteen before, fourteen after.
    expect(without.length).toBe(14);
    expect(with_.length).toBe(14);
  });
});
