/**
 * `endBattle`, the instruction PRD 41 asks for and no front end could build.
 *
 * Verified by simulation against a real unsettled battle on 2026-09-20: 7
 * accounts, 0 signers, 8 bytes of data, `err: null`, 11,936 compute units, and
 * the program's own words - "Battle ended successfully".
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-buy-transaction.json";
import { battleAccountsFromRaw, endBattleInstruction, RENT_SYSVAR } from "../ww/instructions";
import { PROGRAM_ID, SYSTEM_PROGRAM_ID, battlePda, vaultPda } from "../ww/pda";

const battle = battleAccountsFromRaw(
  new Uint8Array(Buffer.from(fixture.battle_account_base64, "base64")),
);
const ix = endBattleInstruction({ battleId: fixture.battle_id, battle });

describe("endBattle", () => {
  it("takes seven accounts and NOT ONE of them is a signer", () => {
    // The whole character of the instruction. If this ever becomes non-zero,
    // settling stopped being permissionless and SOP 1 is wrong.
    expect(ix.keys).toHaveLength(7);
    expect(ix.keys.filter((k) => k.isSigner)).toHaveLength(0);
  });

  it("carries no arguments, only the discriminator", () => {
    // It cannot accept a winner: anyone can call it, so a winner argument would
    // let anyone drain the losing pool to whichever side they liked.
    expect(ix.data).toHaveLength(8);
    expect([...ix.data]).toEqual([80, 145, 208, 48, 183, 92, 168, 112]);
  });

  it("names the accounts in the order the program expects", () => {
    expect(ix.keys.map((k) => k.pubkey)).toEqual([
      battlePda(fixture.battle_id),
      vaultPda(fixture.battle_id),
      battle.artistA,
      battle.artistB,
      battle.wavewarzWallet,
      SYSTEM_PROGRAM_ID,
      RENT_SYSVAR,
    ]);
  });

  it("makes the first five writable and the last two read-only", () => {
    expect(ix.keys.slice(0, 5).every((k) => k.isWritable)).toBe(true);
    expect(ix.keys.slice(5).every((k) => !k.isWritable)).toBe(true);
  });

  it("targets the program", () => {
    expect(ix.programId).toBe(PROGRAM_ID);
  });

  it("derives its own PDAs rather than taking them", () => {
    // A caller passing a battle id gets the right accounts without knowing the
    // seeds. Passing a different id must change them.
    const other = endBattleInstruction({ battleId: 1_700_000_000, battle });
    expect(other.keys[0].pubkey).not.toBe(ix.keys[0].pubkey);
    expect(other.keys[1].pubkey).not.toBe(ix.keys[1].pubkey);
  });
});
