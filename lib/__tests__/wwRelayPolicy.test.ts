/**
 * The relay policy, including against the real signed transaction it has to let
 * through.
 *
 * The green case is not constructed: `ww-buy-transaction-message.json` is the
 * message of a real Phantom-signed mainnet trade, Lighthouse instructions and
 * all. A policy that only ever saw messages this repo built would pass while
 * rejecting every real trade, which is the failure this fixture exists to catch.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-buy-transaction-message.json";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";
import {
  ALLOWED_PROGRAMS,
  LIGHTHOUSE_PROGRAM_ID,
  RELAYABLE,
  decideRelay,
  splitTransaction,
} from "../ww/relayPolicy";
import {
  COMPUTE_BUDGET_PROGRAM_ID,
  computeUnitLimitInstruction,
  parseMessage,
  serializeMessage,
} from "../ww/message";
import { battleAccountsFromRaw, buySharesInstruction, claimSharesInstruction, sellSharesInstruction } from "../ww/instructions";
import { PROGRAM_ID } from "../ww/pda";

const realMessage = new Uint8Array(Buffer.from(fixture.message_base64, "base64"));
const battle = battleAccountsFromRaw(
  new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64")),
);
const trader = buyFixture.accounts_in_order[5];
const blockhash = fixture.expected.recent_blockhash;

describe("the real Phantom-signed trade is allowed", () => {
  it("allows it, and sees the buy among its six instructions", () => {
    const d = decideRelay(realMessage);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.trades).toEqual(["buyShares"]);
    expect(d.instructionCount).toBe(6);
  });

  it("allows it BECAUSE Lighthouse is allowed - remove it and the real trade breaks", () => {
    // The control for the carve-out: this is what a policy without Lighthouse
    // would do to every genuine Phantom transaction.
    const m = parseMessage(realMessage);
    const lighthouse = m.instructions.filter((ix) => ix.programId === LIGHTHOUSE_PROGRAM_ID);
    expect(lighthouse.length).toBe(3);
    expect(ALLOWED_PROGRAMS.has(LIGHTHOUSE_PROGRAM_ID)).toBe(true);
  });
});

describe("what it refuses", () => {
  const build = (ixs: Parameters<typeof serializeMessage>[2]) =>
    serializeMessage(trader, blockhash, ixs);

  it("refuses a transaction touching any other program", () => {
    const foreign = {
      programId: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
      keys: [{ pubkey: trader, isSigner: true, isWritable: true }],
      data: new Uint8Array([1, 2, 3]),
    };
    const d = decideRelay(build([foreign]));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.reason).toMatch(/program not allowed: JUP6/);
  });

  it("refuses compute-budget alone - it mentions no trade to pay for", () => {
    const d = decideRelay(build([computeUnitLimitInstruction(200_000)]));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.reason).toMatch(/no WaveWarZ trade/);
  });

  it("refuses a WaveWarZ instruction that is not one of the three trades", () => {
    // initializeBattle's discriminator. The platform signs those, not a trader,
    // and relaying one would launch a battle in our name.
    const initialize = {
      programId: PROGRAM_ID,
      keys: [{ pubkey: trader, isSigner: true, isWritable: true }],
      data: Uint8Array.from([0x75, 0x6c, 0xa6, 0x9f, 0x92, 0x52, 0xf6, 0xdf, 0, 0]),
    };
    const d = decideRelay(build([initialize]));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.reason).toMatch(/not a relayable trade \(discriminator 756ca69f9252f6df\)/);
  });

  it("refuses endBattle specifically, since settling in our name is the worst case", () => {
    const endBattle = {
      programId: PROGRAM_ID,
      keys: [{ pubkey: trader, isSigner: true, isWritable: true }],
      data: Uint8Array.from([0x50, 0x91, 0xd0, 0x30, 0xb7, 0x5c, 0xa8, 0x70]),
    };
    const d = decideRelay(build([endBattle]));
    expect(d.ok).toBe(false);
  });

  it("refuses a real trade with one foreign instruction smuggled alongside it", () => {
    const buy = buySharesInstruction({
      battleId: buyFixture.battle_id, trader, battle, artistA: true,
      amountLamports: 1, minTokensOut: 0, deadline: 1,
    });
    const drain = {
      programId: "11111111111111111111111111111111",
      keys: [{ pubkey: trader, isSigner: true, isWritable: true }],
      data: new Uint8Array(12),
    };
    const d = decideRelay(build([buy, drain]));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.reason).toMatch(/program not allowed/);
  });

  /**
   * Versioned transactions, refused by design rather than by luck.
   *
   * parseMessage is legacy-only - it resolves programs by indexing the static
   * account-keys array, which a v0 address lookup table defeats. Before this
   * check a v0 message failed only because the 0x80 version byte broke
   * compact-u16 alignment, i.e. accidentally. The danger is a message that
   * parses as all-allowed legacy while the runtime executes it as v0.
   */
  it("refuses a versioned transaction, naming the reason rather than failing to parse", () => {
    const legacy = build([
      buySharesInstruction({
        battleId: buyFixture.battle_id, trader, battle, artistA: true,
        amountLamports: 1, minTokensOut: 0, deadline: 1,
      }),
    ]);
    // The same bytes with the v0 version byte in front.
    const versioned = Uint8Array.from([0x80, ...legacy]);
    const d = decideRelay(versioned);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.reason).toMatch(/versioned transactions not supported/);
    // and the legacy original is still allowed, so the check is not just
    // rejecting everything
    expect(decideRelay(legacy).ok).toBe(true);
  });

  it("refuses any high-bit version byte, not only 0x80", () => {
    for (const v of [0x80, 0x81, 0xff]) {
      const d = decideRelay(Uint8Array.from([v, 1, 0, 6]));
      expect(d.ok).toBe(false);
      if (d.ok) return;
      expect(d.reason).toMatch(/versioned/);
    }
  });

  it("refuses an unparseable message rather than guessing", () => {
    const d = decideRelay(Uint8Array.from([1, 0, 6, 200]));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.reason).toMatch(/unparseable/);
  });

  it("refuses an empty message", () => {
    const d = decideRelay(new Uint8Array(0));
    expect(d.ok).toBe(false);
  });
});

describe("all three trades are relayable", () => {
  const cases = [
    ["buyShares", buySharesInstruction({ battleId: buyFixture.battle_id, trader, battle, artistA: true, amountLamports: 1, minTokensOut: 0, deadline: 1 })],
    ["sellShares", sellSharesInstruction({ battleId: buyFixture.battle_id, trader, battle, artistA: true, amountTokens: 1, minSolOut: 0, deadline: 1 })],
    ["claimShares", claimSharesInstruction({ battleId: buyFixture.battle_id, trader })],
  ] as const;

  for (const [name, ix] of cases) {
    it(`allows ${name}`, () => {
      const d = decideRelay(serializeMessage(trader, blockhash, [ix]));
      expect(d.ok).toBe(true);
      if (!d.ok) return;
      expect(d.trades).toEqual([name]);
    });
  }

  it("the discriminator table matches what the builders actually emit", () => {
    for (const [name, ix] of cases) {
      expect(Buffer.from(ix.data.slice(0, 8)).toString("hex")).toBe(
        RELAYABLE[name as keyof typeof RELAYABLE],
      );
    }
  });
});

describe("splitting a signed transaction", () => {
  it("splits the real one back into one signature and its message", () => {
    const tx = Uint8Array.from([1, ...new Uint8Array(64), ...realMessage]);
    const { signatureCount, message } = splitTransaction(tx);
    expect(signatureCount).toBe(1);
    expect(Buffer.from(message).toString("base64")).toBe(fixture.message_base64);
  });

  it("refuses a claimed signature count the buffer cannot hold", () => {
    // Without the check the offset walks past the end and the message parses as
    // garbage, or as something the policy would wrongly allow.
    expect(() => splitTransaction(Uint8Array.from([5, 1, 2, 3]))).toThrow(/only 4 bytes/);
    expect(() => splitTransaction(Uint8Array.from([200, ...new Uint8Array(64)]))).toThrow(
      /implausible/,
    );
  });

  it("refuses an unsigned or empty transaction", () => {
    expect(() => splitTransaction(Uint8Array.from([0, 1, 2]))).toThrow(/no signature/);
    expect(() => splitTransaction(new Uint8Array(0))).toThrow(/empty/);
  });
});
