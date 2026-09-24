/**
 * Launching is the first thing this repo does that CREATES something on chain
 * rather than reading it. The cost is quoted before a wallet is asked, so the
 * quote has to be right or silent about being wrong.
 */
import { describe, expect, it } from "vitest";
import {
  BATTLE_ACCOUNT_BYTES,
  canAfford,
  checkLaunch,
  launchCost,
  LAUNCH_ACCOUNTS,
  MINT_ACCOUNT_BYTES,
  VAULT_ACCOUNT_BYTES,
} from "../ww/launchPlan";

/** The numbers mainnet actually quoted on 2026-09-24. */
const RENT = new Map([
  [BATTLE_ACCOUNT_BYTES, 2_443_440],
  [VAULT_ACCOUNT_BYTES, 650_000],
  [MINT_ACCOUNT_BYTES, 1_066_800],
]);

describe("the cost", () => {
  it("adds up the four accounts the program creates", () => {
    const c = launchCost(RENT, 5_000);
    expect(c.lines.map((l) => l.name)).toEqual([
      "battle account",
      "vault",
      "artist A mint",
      "artist B mint",
    ]);
    // Two mints, counted twice, which is the error a set would make.
    expect(c.rentLamports).toBe(2_443_440 + 650_000 + 1_066_800 * 2);
    expect(c.totalLamports).toBe(c.rentLamports + 5_000);
    expect(c.isFloor).toBe(false);
  });

  it("REFUSES to quote a partial cost when an account has no rent figure", () => {
    // Silently dropping the line would under-quote by exactly the amount
    // nobody was told about.
    expect(() => launchCost(new Map([[BATTLE_ACCOUNT_BYTES, 2_443_440]]), 5_000)).toThrow(
      /no rent quoted for vault/,
    );
  });

  it("marks the total a FLOOR when the cluster quoted no fee, rather than adding zero", () => {
    const c = launchCost(RENT, null);
    expect(c.networkFeeLamports).toBeNull();
    expect(c.isFloor).toBe(true);
    expect(c.totalLamports).toBe(c.rentLamports);
  });
});

describe("affordability", () => {
  it("is a plain yes or no when the fee is known", () => {
    const c = launchCost(RENT, 5_000);
    expect(canAfford(c.totalLamports, c)).toBe(true);
    expect(canAfford(c.totalLamports - 1, c)).toBe(false);
  });

  it("is UNKNOWN, not true, when the fee is missing and the balance is close", () => {
    const c = launchCost(RENT, null);
    expect(canAfford(c.totalLamports, c)).toBeNull();
  });

  it("is still a definite NO when the balance cannot even cover the floor", () => {
    const c = launchCost(RENT, null);
    expect(canAfford(c.totalLamports - 1, c)).toBe(false);
  });
});

describe("what it refuses to launch", () => {
  const now = 1_790_000_000;
  const ok = {
    battleId: now + 300,
    durationSeconds: 600,
    artistA: "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk",
    artistB: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
  };

  it("accepts a sound one", () => {
    expect(checkLaunch(ok, now)).toEqual({ ok: true });
  });

  it("refuses a start time in the past, because the id IS the start time", () => {
    expect(checkLaunch({ ...ok, battleId: now - 1 }, now)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("already passed"),
    });
    // The boundary is now, not after it.
    expect(checkLaunch({ ...ok, battleId: now }, now).ok).toBe(true);
  });

  it("refuses both sides being one wallet", () => {
    expect(checkLaunch({ ...ok, artistB: ok.artistA }, now)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("nothing to bet between"),
    });
  });

  it("refuses a duration that is zero, negative or fractional", () => {
    for (const d of [0, -600, 600.5]) {
      expect(checkLaunch({ ...ok, durationSeconds: d }, now).ok).toBe(false);
    }
  });

  it("allows exactly 24 hours, which 26 battles have run, and refuses past it", () => {
    expect(checkLaunch({ ...ok, durationSeconds: 86_400 }, now).ok).toBe(true);
    expect(checkLaunch({ ...ok, durationSeconds: 86_401 }, now).ok).toBe(false);
  });

  it("refuses an address that is not base58", () => {
    expect(checkLaunch({ ...ok, artistA: "not an address" }, now)).toMatchObject({
      ok: false,
      reason: expect.stringContaining("artist A"),
    });
    // 0, O, I and l are not in the base58 alphabet.
    expect(checkLaunch({ ...ok, artistA: "0".repeat(44) }, now).ok).toBe(false);
  });
});

describe("the account list", () => {
  it("names four accounts, because the creator pays rent on four", () => {
    expect(LAUNCH_ACCOUNTS).toHaveLength(4);
    expect(LAUNCH_ACCOUNTS.filter((a) => a.bytes === MINT_ACCOUNT_BYTES)).toHaveLength(2);
  });
});
