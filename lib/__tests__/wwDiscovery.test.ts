/**
 * Discovery, against twelve real `getProgramAccounts` rows captured from
 * mainnet on 2026-09-20 with the same `dataSlice` the module asks for.
 *
 * The fixture is deliberately mixed: eight settled, four past their end time
 * and never settled, and the live ones the platform had at capture time, which
 * was zero. A fixture of only healthy rows would let a phase bug through, and
 * "awaiting settlement" is the phase this estate has spent two days on.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-discovery-rows.json";
import {
  BATTLE_ACCOUNT_BYTES,
  DISCOVERY_SLICE_BYTES,
  awaitingSettlement,
  battleDiscoveryRequest,
  liveBattles,
  parseBattleAccount,
  parseBattleAccounts,
  phaseCounts,
  settledWithValue,
  type ProgramAccountRow,
} from "../ww/discovery";
import { PROGRAM_ID } from "../ww/pda";

// `as unknown as` because JSON widens the two-element data tuple to string[].
const rows = (fixture as unknown as { rows: ProgramAccountRow[] }).rows;
const b64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));
// Pinned so phase is deterministic: a few minutes after the capture.
const NOW = 1_789_910_000;

describe("the request", () => {
  it("filters by the exact account size and slices to what it reads", () => {
    const r = battleDiscoveryRequest();
    const opts = r.params[1] as Record<string, unknown>;
    expect(r.params[0]).toBe(PROGRAM_ID);
    expect(opts.filters).toEqual([{ dataSize: BATTLE_ACCOUNT_BYTES }]);
    expect(opts.dataSlice).toEqual({ offset: 0, length: DISCOVERY_SLICE_BYTES });
  });

  it("slices to less than the account, or the slice is pointless", () => {
    expect(DISCOVERY_SLICE_BYTES).toBeLessThan(BATTLE_ACCOUNT_BYTES);
  });

  it("takes another program id, for a different deployment", () => {
    const r = battleDiscoveryRequest("11111111111111111111111111111111");
    expect(r.params[0]).toBe("11111111111111111111111111111111");
  });
});

describe("parsing real rows", () => {
  const parsed = parseBattleAccounts(rows, b64, NOW);

  it("decodes every row in the fixture", () => {
    expect(parsed).toHaveLength(rows.length);
  });

  it("gives every battle an id in the plausible range", () => {
    for (const b of parsed) {
      expect(b.battleId).toBeGreaterThan(1_600_000_000);
      expect(b.battleId).toBeLessThan(2_600_000_000);
    }
  });

  it("keeps the account address, so a caller need not re-derive it", () => {
    for (const b of parsed) expect(b.pubkey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("matches the values read from chain at capture", () => {
    const b = parsed.find((x) => x.battleId === 1775872146)!;
    expect(b.settled).toBe(true);
    expect(b.poolLamports).toEqual({ a: 19_700_000, b: 68_950_000 });
    expect(b.endTime).toBe(1_775_872_572);
    // Side B holds the larger pool, and the program settles on the larger pool.
    expect(b.settlementWinner).toBe("artist_b");
  });

  it("starts before it ends, on every row", () => {
    for (const b of parsed) expect(b.endTime).toBeGreaterThan(b.startTime);
  });
});

describe("phases", () => {
  const parsed = parseBattleAccounts(rows, b64, NOW);

  it("counts add up to the rows parsed", () => {
    const c = phaseCounts(parsed);
    expect(c.live + c["awaiting-settlement"] + c.settled).toBe(parsed.length);
  });

  it("finds the battles past their end that never settled", () => {
    const aw = awaitingSettlement(parsed);
    expect(aw.length).toBeGreaterThan(0);
    for (const b of aw) {
      expect(b.settled).toBe(false);
      expect(b.endTime).toBeLessThan(NOW);
      expect(b.settlementWinner).toBeNull();
    }
  });

  it("never calls an unsettled battle settled just because its clock ran out", () => {
    // The distinction the whole estate spent two days on: a claim against one of
    // these returns BattleNotEnded while the site may say the winner is decided.
    for (const b of parsed) {
      if (!b.settled) expect(b.phase).not.toBe("settled");
    }
  });

  it("calls a battle live only while its clock is still running", () => {
    const early = parseBattleAccounts(rows, b64, 1_700_000_000);
    for (const b of liveBattles(early)) expect(b.endTime).toBeGreaterThan(1_700_000_000);
    // The same rows read far in the future contain no live battle at all.
    expect(liveBattles(parseBattleAccounts(rows, b64, 2_000_000_000))).toHaveLength(0);
  });

  it("orders awaiting-settlement oldest first, which is the order to clear them", () => {
    const aw = awaitingSettlement(parseBattleAccounts(rows, b64, NOW));
    for (let i = 1; i < aw.length; i++) expect(aw[i].endTime).toBeGreaterThanOrEqual(aw[i - 1].endTime);
  });

  it("orders settled-with-value biggest first, and excludes empty ones", () => {
    const s = settledWithValue(parseBattleAccounts(rows, b64, NOW));
    for (const b of s) expect(b.poolLamports.a + b.poolLamports.b).toBeGreaterThan(0);
    for (let i = 1; i < s.length; i++) {
      const prev = s[i - 1].poolLamports.a + s[i - 1].poolLamports.b;
      expect(s[i].poolLamports.a + s[i].poolLamports.b).toBeLessThanOrEqual(prev);
    }
  });
});

describe("what it refuses", () => {
  const row = (data: string): ProgramAccountRow => ({ pubkey: "x", account: { data: [data, "base64"] } });

  it("returns null rather than throwing on a row that is not a battle", () => {
    expect(parseBattleAccount(row(Buffer.alloc(256).toString("base64")), b64, NOW)).toBeNull();
  });

  it("returns null on a short account", () => {
    expect(parseBattleAccount(row(Buffer.alloc(100).toString("base64")), b64, NOW)).toBeNull();
  });

  it("returns null on data that is not base64 at all", () => {
    const boom = () => {
      throw new Error("not base64");
    };
    expect(parseBattleAccount(row("!!!"), boom, NOW)).toBeNull();
  });

  it("drops the bad rows and keeps the good ones in the same sweep", () => {
    const mixed = [...rows, row(Buffer.alloc(256).toString("base64"))];
    expect(parseBattleAccounts(mixed, b64, NOW)).toHaveLength(rows.length);
  });
});
