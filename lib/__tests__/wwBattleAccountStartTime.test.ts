/**
 * `startTime` has to survive the whole path from the account bytes to the
 * panel, because the panel uses it to refuse a trade the program would refuse.
 * A field that decodes but never reaches the caller is the same as no field.
 */
import { describe, expect, it } from "vitest";
import { decodeBattleAccountResponse } from "../ww/battleAccountResponse";
import { BUY_OPENS_AFTER_START_SECONDS, tradeableFrom } from "../ww/tradeWindow";

/** A battle account with a known start and end, laid out at the real offsets. */
function account(startTime: number, endTime: number): Uint8Array {
  const raw = new Uint8Array(300);
  const dv = new DataView(raw.buffer);
  dv.setBigInt64(20, BigInt(startTime), true);
  dv.setBigInt64(28, BigInt(endTime), true);
  return raw;
}

describe("startTime comes off the account", () => {
  it("reads offset 20, not the end time at 28", () => {
    const d = decodeBattleAccountResponse(account(1_790_211_141, 1_790_211_741));
    expect(d.startTime).toBe(1_790_211_141);
    expect(d.endTime).toBe(1_790_211_741);
  });

  it("handles a start and end that differ by one second, so the two are not confused", () => {
    const d = decodeBattleAccountResponse(account(1_000, 1_001));
    expect(d.startTime).toBe(1_000);
    expect(d.endTime).toBe(1_001);
  });
});

describe("the minute a battle is open and untradeable", () => {
  /**
   * The state that looks like nothing else the panel handles: not settled, not
   * ended, and every buy refused with BattleNotActive (6003).
   */
  const start = 1_790_211_141;
  const open = start + BUY_OPENS_AFTER_START_SECONDS;

  it("is closed at 59 seconds and open at 60, matching the measurement", () => {
    expect(start + 59 < open).toBe(true);
    expect(start + 60 < open).toBe(false);
  });

  it("is the same instant the gap report measures from, when the mints were early", () => {
    // One module decides when trading opens; the panel and the report share it.
    expect(tradeableFrom(start, start + 10)).toBe(open);
  });
});
