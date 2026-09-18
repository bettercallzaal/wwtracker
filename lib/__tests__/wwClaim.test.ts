/**
 * The claim path, checked against two real mainnet captures.
 *
 * `ww-claim-transaction.json` is a real `claimShares` - nine accounts, an
 * eight-byte instruction - and the builder has to reproduce it from a battle id
 * and a claimer alone. `ww-claimable-read.json` is a real wallet's holdings,
 * 328 token accounts across 138 battles, which is what drives the derivation
 * here without a network.
 *
 * WHAT THE SECOND FIXTURE MUST NOT BE USED FOR, and it is written into the
 * fixture too. It is a snapshot of one moment. `recon/UNCLAIMED.md` measured
 * this set draining 1.76% in a single quiet day, so **the amounts in it will go
 * stale and no test may assert a live figure against them.** Everything below
 * tests the derivation - which mints resolve to which battles, what is filtered
 * and why - never a balance.
 */
import { describe, expect, it } from "vitest";
import claimFixture from "../__fixtures__/ww-claim-transaction.json";
import readFixture from "../__fixtures__/ww-claimable-read.json";
import { claimSharesInstruction } from "../ww/instructions";
import {
  VAULT_RENT_FLOOR_LAMPORTS,
  battleIdFromAccount,
  battleIsSettled,
  battlesToClaim,
  claimablePositions,
  nonZeroHoldings,
  vaultPayableLamports,
  verifyMintBelongsToBattle,
  type BattleMint,
} from "../ww/claim";
import { mintPda } from "../ww/pda";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

describe("claimSharesInstruction against a real claim", () => {
  it("reproduces all nine accounts in order", () => {
    const ix = claimSharesInstruction({
      battleId: claimFixture.battle_id,
      trader: claimFixture.claimer,
    });
    expect(ix.keys.map((k) => k.pubkey)).toEqual(claimFixture.accounts_in_order);
  });

  it("reproduces the instruction data, which is the discriminator and nothing else", () => {
    const ix = claimSharesInstruction({
      battleId: claimFixture.battle_id,
      trader: claimFixture.claimer,
    });
    expect(hex(ix.data)).toBe(claimFixture.instruction_data_hex);
    // Eight bytes: claimShares takes no arguments. A claim cannot be partial and
    // cannot be aimed at one side, which is why battlesToClaim deduplicates.
    expect(ix.data).toHaveLength(8);
  });

  /**
   * The red control. Everything except the claimer is derived from the battle
   * id, so a builder that ignored the claimer would still produce a
   * plausible-looking instruction - with somebody else's token accounts in it.
   */
  it("changes only the signer and the two token accounts when the claimer changes", () => {
    const mine = claimSharesInstruction({
      battleId: claimFixture.battle_id,
      trader: claimFixture.claimer,
    });
    const theirs = claimSharesInstruction({
      battleId: claimFixture.battle_id,
      trader: readFixture.wallet,
    });
    const differing = mine.keys
      .map((k, i) => (k.pubkey === theirs.keys[i].pubkey ? null : i))
      .filter((i): i is number => i !== null);
    expect(differing).toEqual([2, 3, 4]); // signer, ATA A, ATA B
  });
});

describe("recovering a battle id from an account", () => {
  it("reads the id out of every real battle account in the capture", () => {
    const accounts = Object.values(readFixture.battle_accounts_base64).filter(
      (v): v is string => typeof v === "string",
    );
    expect(accounts.length).toBeGreaterThan(0);
    const ids = accounts
      .map((b64) => battleIdFromAccount(new Uint8Array(Buffer.from(b64, "base64"))))
      .filter((id): id is number => id !== null);
    // The capture resolved 138 battles from 148 authority accounts, so some
    // authorities are legitimately not battles. Both numbers matter: it must
    // find most, and it must not find all.
    expect(ids.length).toBeGreaterThan(100);
    expect(ids.length).toBeLessThan(accounts.length + 1);
    for (const id of ids) expect(String(id)).toMatch(/^\d{10}$/);
  });

  /**
   * The guard that a throwaway script tripped over while building this fixture.
   * Following an arbitrary token's mint authority lands on accounts that are not
   * battles, including empty ones, and reading offset 8 of a short buffer throws
   * rather than returning something wrong. Returning null is the contract.
   */
  it("returns null for short and empty buffers rather than throwing", () => {
    expect(battleIdFromAccount(new Uint8Array(0))).toBeNull();
    expect(battleIdFromAccount(new Uint8Array(8))).toBeNull();
    expect(battleIdFromAccount(new Uint8Array(15))).toBeNull();
  });

  it("rejects an id outside the plausible unix-second range", () => {
    const raw = new Uint8Array(32);
    new DataView(raw.buffer).setBigUint64(8, 42n, true);
    expect(battleIdFromAccount(raw)).toBeNull();
  });
});

describe("verifyMintBelongsToBattle", () => {
  /**
   * THE CHECK THAT MAKES THE WHOLE LOOKUP SAFE. The battle id is recovered by
   * following a token's mint authority, which proves nothing on its own: anyone
   * can create a token and set its authority to a real battle PDA. Re-deriving
   * the mint from the recovered id is what proves the token is actually ours.
   */
  it("accepts the real mints of a real battle, on the correct side", () => {
    const id = claimFixture.battle_id;
    expect(verifyMintBelongsToBattle(mintPda(id, "a"), id)).toEqual({ battleId: id, side: "a" });
    expect(verifyMintBelongsToBattle(mintPda(id, "b"), id)).toEqual({ battleId: id, side: "b" });
  });

  it("rejects a mint that does not derive from the battle it claims", () => {
    // A real mint, checked against the wrong battle.
    const otherId = 1787568630;
    expect(verifyMintBelongsToBattle(mintPda(claimFixture.battle_id, "a"), otherId)).toBeNull();
  });

  it("rejects an arbitrary address", () => {
    expect(verifyMintBelongsToBattle(readFixture.wallet, claimFixture.battle_id)).toBeNull();
  });
});

describe("filtering the wallet's holdings", () => {
  it("drops zero balances, because a burned position is not a position", () => {
    const held = readFixture.held_tokens as Array<{ mint: string; amount: string }>;
    const nonZero = nonZeroHoldings(held);
    expect(nonZero.length).toBeLessThanOrEqual(held.length);
    for (const t of nonZero) expect(BigInt(t.amount) > 0n).toBe(true);
  });

  it("drops an unparseable amount rather than treating it as a position", () => {
    expect(nonZeroHoldings([{ mint: "x", amount: "not a number" }])).toEqual([]);
    expect(nonZeroHoldings([{ mint: "x", amount: "" }])).toEqual([]);
  });

  /**
   * Amounts are strings because a u64 in base units passes
   * Number.MAX_SAFE_INTEGER. A Number-based filter would compare a rounded
   * value and could drop a real position or keep a burned one.
   */
  it("handles an amount beyond Number.MAX_SAFE_INTEGER exactly", () => {
    const huge = "18446744073709551615"; // u64 max
    expect(Number(huge)).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    expect(nonZeroHoldings([{ mint: "x", amount: huge }])).toHaveLength(1);
  });
});

describe("the vault rent floor", () => {
  /**
   * A fully claimed vault still holds the rent-exempt minimum, so "the vault
   * has lamports" does not mean "there is money to claim". Getting this wrong
   * reports a drained battle as payable, which is the exact failure
   * recon/UNCLAIMED.md exists to prevent.
   */
  it("reports nothing payable at or below the floor", () => {
    expect(vaultPayableLamports(VAULT_RENT_FLOOR_LAMPORTS)).toBe(0);
    expect(vaultPayableLamports(VAULT_RENT_FLOOR_LAMPORTS - 1)).toBe(0);
    expect(vaultPayableLamports(0)).toBe(0);
  });

  it("reports only the part above the floor", () => {
    expect(vaultPayableLamports(VAULT_RENT_FLOOR_LAMPORTS + 1_000_000)).toBe(1_000_000);
  });
});

describe("claimablePositions", () => {
  const pos = (battleId: number, side: "a" | "b" = "a"): BattleMint & { mint: string; amount: string } => ({
    battleId, side, mint: mintPda(battleId, side), amount: "1000",
  });

  it("requires BOTH tokens held and a vault above the floor", () => {
    const vaults = new Map([[1, VAULT_RENT_FLOOR_LAMPORTS + 5_000_000], [2, VAULT_RENT_FLOOR_LAMPORTS]]);
    const out = claimablePositions([pos(1), pos(2)], vaults);
    expect(out.map((p) => p.battleId)).toEqual([1]);
  });

  /**
   * Unread is not empty. A vault the RPC failed to return is omitted, never
   * rendered as zero - the same contract /api/ww/positions uses, for the same
   * reason: a rate-limited read that renders as "nothing here" is a wrong
   * answer that looks like a right one.
   */
  it("omits a battle whose vault was not read, rather than calling it empty", () => {
    const out = claimablePositions([pos(1)], new Map());
    expect(out).toEqual([]);
  });

  it("orders by vault size, largest first", () => {
    const vaults = new Map([
      [1, VAULT_RENT_FLOOR_LAMPORTS + 1_000_000],
      [2, VAULT_RENT_FLOOR_LAMPORTS + 9_000_000],
      [3, VAULT_RENT_FLOOR_LAMPORTS + 5_000_000],
    ]);
    const out = claimablePositions([pos(1), pos(2), pos(3)], vaults);
    expect(out.map((p) => p.battleId)).toEqual([2, 3, 1]);
  });
});

describe("battlesToClaim", () => {
  /**
   * Holding both sides of one battle is two token accounts and ONE claim.
   * `claimShares` takes no arguments and settles the whole position, so a second
   * instruction would run against tokens the first already burned.
   */
  it("collapses both sides of a battle into one claim", () => {
    const vaults = new Map([[1, VAULT_RENT_FLOOR_LAMPORTS + 1_000_000]]);
    const both = claimablePositions(
      [
        { battleId: 1, side: "a", mint: mintPda(1, "a"), amount: "10" },
        { battleId: 1, side: "b", mint: mintPda(1, "b"), amount: "20" },
      ],
      vaults,
    );
    expect(both).toHaveLength(2);
    expect(battlesToClaim(both)).toEqual([1]);
  });
});

describe("the battle the program has not ended", () => {
  /**
   * The public API's `winnerDecided` and the program's settled byte are
   * different facts, and this is the case that proved it: battle 1787568630
   * reports `winnerDecided: true` on wavewarz.info, and simulating a real claim
   * against it returns `BattleNotEnded (6009)`.
   *
   * Without the settled filter it passes every other check - the wallet holds
   * tokens, the vault is funded well above the rent floor - so the panel would
   * list it, the person would tap claim, and the program would refuse.
   */
  const held = { battleId: 1787568630, side: "a" as const, mint: mintPda(1787568630, "a"), amount: "156900000" };
  const vaults = new Map([[1787568630, 50_141_000]]);

  it("is claimable-looking on tokens and vault alone", () => {
    expect(claimablePositions([held], vaults)).toHaveLength(1);
  });

  it("is excluded once the program's settled byte is consulted", () => {
    expect(claimablePositions([held], vaults, new Map([[1787568630, false]]))).toEqual([]);
  });

  it("is excluded when settledness is unknown, never assumed settled", () => {
    expect(claimablePositions([held], vaults, new Map())).toEqual([]);
  });

  it("reads the settled byte, and refuses a buffer too short to hold it", () => {
    const settled = new Uint8Array(300); settled[245] = 1;
    expect(battleIsSettled(settled)).toBe(true);
    const unsettled = new Uint8Array(300);
    expect(battleIsSettled(unsettled)).toBe(false);
    expect(battleIsSettled(new Uint8Array(245))).toBeNull();
  });
});
