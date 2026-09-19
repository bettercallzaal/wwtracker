/**
 * PRD section 31, cross-checked against the implementation that already existed.
 *
 * THE GATE IS THE DISAGREEMENT TEST. `tools/battle-record.py` in the protocol
 * repo emits this record from our committed census; this function emits it from
 * raw account bytes. Different language, different source, same battles. Every
 * chain-derived field is compared for all thirty battles in the fixture, and one
 * field disagreeing on one battle fails the suite.
 *
 * That cross-check has already paid for itself: it settled an offset the two
 * artefacts documented differently. `battle-record.py`'s `field_sources` says
 * `final_pool_b` is at offset 228. It is at 220 - offset 220 matches the
 * emitter's own values 30/30 and offset 228 matches 2/30, which is coincidence
 * on battles where both read zero. The emitter's RECORDS are right, because it
 * reads the parsed census and never uses that offset; only the provenance note
 * is wrong. A provenance note is prose that nothing executes, so nothing could
 * contradict it until something parsed the bytes.
 */
import { describe, expect, it } from "vitest";
import fixture from "../__fixtures__/ww-battle-records.json";
import { buildBattleRecord, unsetFields, MIN_BATTLE_ACCOUNT_BYTES } from "../ww/battleRecord";
import { PROGRAM_ID } from "../ww/pda";

interface Pair {
  record: Record<string, unknown>;
  account_base64: string;
}
const pairs = fixture.pairs as unknown as Pair[];

const build = (p: Pair) =>
  buildBattleRecord({
    battlePda: p.record.battle_pda as string,
    programId: PROGRAM_ID,
    account: new Uint8Array(Buffer.from(p.account_base64, "base64")),
  });

describe("the fixture is what it claims to be", () => {
  it("pairs thirty real accounts with the emitter's records, across the whole history", () => {
    expect(pairs.length).toBe(30);
    for (const p of pairs) expect(p.account_base64).toBeTruthy();
    const ids = pairs.map((p) => p.record.battle_id as number);
    // Spread, not a recent slice: an old layout change would only show at the start.
    expect(Math.min(...ids)).toBeLessThan(1_750_000_000);
    expect(Math.max(...ids)).toBeGreaterThan(1_780_000_000);
  });
});

describe("every chain field agrees with the Python emitter, on every battle", () => {
  /**
   * The mapping is explicit because the two implementations use different NAMES
   * for the same field - the PRD says `artist_a_final_pool`, the emitter says
   * `final_pool_a`. A test that matched by name would silently compare nothing.
   */
  const CHAIN_FIELDS: Array<[ours: string, theirs: string]> = [
    ["battle_id", "battle_id"],
    ["battle_pda", "battle_pda"],
    ["program_id", "program_id"],
    ["start_time", "start_time"],
    ["end_time", "end_time"],
    ["artist_a_final_supply", "final_supply_a"],
    ["artist_b_final_supply", "final_supply_b"],
    ["artist_a_final_pool", "final_pool_a"],
    ["artist_b_final_pool", "final_pool_b"],
    ["settled", "settled"],
  ];

  for (const [ours, theirs] of CHAIN_FIELDS) {
    it(`agrees on ${ours} for all thirty`, () => {
      const disagreements: string[] = [];
      for (const p of pairs) {
        const mine = (build(p) as unknown as Record<string, unknown>)[ours];
        const yours = p.record[theirs];
        if (mine !== yours) {
          disagreements.push(`battle ${p.record.battle_id}: ours ${mine}, emitter ${yours}`);
        }
      }
      expect(disagreements).toEqual([]);
    });
  }

  /**
   * The settled winner. The emitter names it as a SIDE - "artist_a" / "artist_b" -
   * and so does this function, so they compare directly.
   *
   * The first version of this test converted ours to a wallet before comparing,
   * on the assumption that the emitter stored wallets. It does not, and 29 of 30
   * "disagreed" as a result. The code was right and the test's mapping was
   * wrong, which is worth leaving in the comment: a cross-check that fails
   * because of its own translation layer looks exactly like a real defect.
   */
  it("agrees on which side the program settled to", () => {
    const disagreements: string[] = [];
    for (const p of pairs) {
      const mine = build(p).settlement_winner;
      const theirs = (p.record.settlement_winner as string | null) ?? null;
      if (mine !== theirs) {
        disagreements.push(`battle ${p.record.battle_id}: ours ${mine}, emitter ${theirs}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  /**
   * THE OFFSET THE CROSS-CHECK SETTLED. Pinned so a future edit that "corrects"
   * 220 to the 228 in the emitter's documentation fails immediately.
   */
  it("reads artist_b_final_pool at 220, where 228 matches only by coincidence", () => {
    let at220 = 0;
    let at228 = 0;
    for (const p of pairs) {
      const raw = new Uint8Array(Buffer.from(p.account_base64, "base64"));
      const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      if (Number(dv.getBigUint64(220, true)) === p.record.final_pool_b) at220++;
      if (Number(dv.getBigUint64(228, true)) === p.record.final_pool_b) at228++;
    }
    expect(at220).toBe(30);
    expect(at228).toBeLessThan(5);
  });
});

describe("what it will not invent", () => {
  const record = build(pairs[0]);

  it("leaves the eight standard-level decisions null, each with a reason", () => {
    const unset = unsetFields(record).map((u) => u.field);
    for (const f of [
      "protocol_version", "ruleset", "ranked",
      "artist_a_id", "artist_b_id", "track_a_id", "track_b_id",
      "input_assets_used",
    ]) {
      expect(unset, `${f} must be unset`).toContain(f);
      expect(record.sources[f]).toMatch(/^unset:/);
    }
  });

  it("explains settlement_tx rather than omitting or guessing it", () => {
    // A PRD field the Python emitter does not produce at all.
    expect(record.settlement_tx).toBeNull();
    expect(record.sources.settlement_tx).toMatch(/records THAT it settled/);
  });

  /**
   * "Nobody looked" and "nobody traded" must not render the same. An omitted
   * trades list gives null; an empty one gives 0, which is a real measurement
   * of a real battle.
   */
  it("distinguishes trades not supplied from a battle nobody traded", () => {
    const notSupplied = build(pairs[0]);
    expect(notSupplied.total_volume).toBeNull();
    expect(notSupplied.unique_traders).toBeNull();
    expect(notSupplied.sources.total_volume).toMatch(/not supplied/);

    const noneTraded = buildBattleRecord({
      battlePda: pairs[0].record.battle_pda as string,
      programId: PROGRAM_ID,
      account: new Uint8Array(Buffer.from(pairs[0].account_base64, "base64")),
      trades: [],
    });
    expect(noneTraded.total_volume).toBe(0);
    expect(noneTraded.unique_traders).toBe(0);
    expect(noneTraded.sources.total_volume).toMatch(/derived/);
  });

  it("derives volume and traders from supplied trades, excluding claims", () => {
    const built = buildBattleRecord({
      battlePda: pairs[0].record.battle_pda as string,
      programId: PROGRAM_ID,
      account: new Uint8Array(Buffer.from(pairs[0].account_base64, "base64")),
      trades: [
        { kind: "buy", trader: "A", lamports: 100 },
        { kind: "sell", trader: "A", lamports: 40 },
        { kind: "buy", trader: "B", lamports: 60 },
        // A claim is not a trade: it moves settled SOL, not traded volume.
        { kind: "claim", trader: "C", lamports: 999 },
      ],
    });
    expect(built.total_volume).toBe(200);
    expect(built.unique_traders).toBe(2);
  });

  it("records operator and judged winner as not supplied, rather than as absent facts", () => {
    expect(record.operator_id).toBeNull();
    expect(record.sources.operator_id).toMatch(/not supplied/);
    expect(record.result_winner).toBeNull();
    expect(record.sources.result_winner).toMatch(/not supplied/);

    const withOff = buildBattleRecord({
      battlePda: pairs[0].record.battle_pda as string,
      programId: PROGRAM_ID,
      account: new Uint8Array(Buffer.from(pairs[0].account_base64, "base64")),
      offChain: { operatorId: null, resultWinner: null },
    });
    // Explicitly null is a RESULT - unattributed, unjudged - not the same as unasked.
    expect(withOff.sources.operator_id).toMatch(/UNATTRIBUTED/);
    expect(withOff.sources.result_winner).toMatch(/no judged result/);
  });
});

describe("a battle has two winners, and the record keeps both", () => {
  /**
   * The emitter measured them disagreeing on 174 of the 1,246 battles that have
   * both. A single `winner` field would have to pick one and misreport the
   * other, which is what spec/BATTLE-RECORD.md settled.
   */
  it("carries the settled winner and the judged winner separately", () => {
    const built = buildBattleRecord({
      battlePda: pairs[0].record.battle_pda as string,
      programId: PROGRAM_ID,
      account: new Uint8Array(Buffer.from(pairs[0].account_base64, "base64")),
      offChain: { resultWinner: "artist2" },
    });
    expect(built.settlement_winner).toBeTruthy();
    expect(built.result_winner).toBe("artist2");
    expect(Object.keys(built)).not.toContain("winner");
  });

  it("names no settled winner for a battle the program has not settled", () => {
    const raw = new Uint8Array(Buffer.from(pairs[0].account_base64, "base64"));
    raw[245] = 0; // unsettled
    const built = buildBattleRecord({
      battlePda: "x", programId: PROGRAM_ID, account: raw,
    });
    expect(built.settled).toBe(false);
    expect(built.settlement_winner).toBeNull();
    expect(built.sources.settlement_winner).toMatch(/has not settled/);
  });
});

describe("refusals", () => {
  it("refuses an account too short to hold the fields it reads", () => {
    expect(() =>
      buildBattleRecord({ battlePda: "x", programId: PROGRAM_ID, account: new Uint8Array(100) }),
    ).toThrow(new RegExp(String(MIN_BATTLE_ACCOUNT_BYTES)));
  });
});
