/**
 * One decoder for the battle account, and the widget's route uses it.
 *
 * WHAT WAS WRONG, and it was a latent split rather than a live bug.
 * `/api/ww/battle-account` decoded the pools at bytes 228 and 236 with a
 * comment saying they were "the same offsets lib/battlePositions decodes".
 * `decodeBattle` reads 212 and 220. `battleStateFromRaw` in tradePlan.ts reads
 * 212 and 220. Three readers, two layouts, one comment that was untrue.
 *
 * It never bit because 228/236 are byte-identical duplicates of 212/220 on
 * every account anyone has decoded (chain/BATTLE-ACCOUNT.md in the protocol
 * repo: 1,643 of 1,643; re-measured on 2026-09-21 against two live accounts and
 * the buy fixture). A duplicate that has always agreed is exactly the kind of
 * thing that stops agreeing the day the program is upgraded, and the widget
 * would then price a sell off the wrong number with no error anywhere.
 *
 * So the route now decodes through ONE function, pinned here against the
 * fixture and against `decodeBattle`, and the duplicate is recorded as a fact
 * rather than relied on.
 */
import { describe, expect, it } from "vitest";
import { decodeBattleAccountResponse } from "../ww/battleAccountResponse";
import { decodeBattle } from "../battlePositions";
import buyFixture from "../__fixtures__/ww-buy-transaction.json";

const raw = new Uint8Array(Buffer.from(buyFixture.battle_account_base64, "base64"));

describe("decodeBattleAccountResponse", () => {
  it("reads the pools where decodeBattle reads them, in lamports", () => {
    const r = decodeBattleAccountResponse(raw);
    const d = decodeBattle(raw);
    expect(r.poolALamports).toBe(Math.round(d.poolASol * 1e9));
    expect(r.poolBLamports).toBe(Math.round(d.poolBSol * 1e9));
  });

  it("reads the minted supplies, which the sell quote needs and the old route omitted", () => {
    const r = decodeBattleAccountResponse(raw);
    const d = decodeBattle(raw);
    expect(r.supplyA).toBe(d.supplyA);
    expect(r.supplyB).toBe(d.supplyB);
    expect(r.supplyA).toBeGreaterThan(0);
    expect(r.supplyB).toBeGreaterThan(0);
  });

  it("carries the clock and the settlement bytes", () => {
    const r = decodeBattleAccountResponse(raw);
    const d = decodeBattle(raw);
    expect(r.endTime).toBe(d.endTime);
    expect(r.settled).toBe(d.settled);
    expect(r.winnerArtistA).toBe(d.winnerArtistA);
  });

  /**
   * The duplicate, recorded. If this ever fails the program's layout changed
   * and every reader of 228/236 was wrong from that moment; the route no longer
   * reads them, so this is the alarm rather than the failure.
   */
  it("bytes 228 and 236 duplicate 212 and 220 on the fixture", () => {
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    expect(dv.getBigUint64(228, true)).toBe(dv.getBigUint64(212, true));
    expect(dv.getBigUint64(236, true)).toBe(dv.getBigUint64(220, true));
  });

  it("refuses an account shorter than the layout, naming the size", () => {
    expect(() => decodeBattleAccountResponse(raw.slice(0, 200))).toThrow(/200 bytes/);
  });
});
