/**
 * PRD 32 against thirty real battles.
 *
 * The fixture pairs a record emitted by the protocol repo's Python emitter with
 * the raw account it was built from. That makes this a genuine cross-check: if
 * the verifier and the emitter disagree about a byte, one of them is wrong and
 * the suite says so.
 *
 * THE TESTS THAT MATTER MOST ARE THE ONES THAT MUST FAIL. A verifier that
 * returns `chain-consistent` for everything passes the happy path perfectly
 * and is worthless. Every field it claims to check is mutated here and must
 * produce a contradiction.
 */
import { describe, it, expect } from "vitest";
import fixture from "../__fixtures__/ww-battle-records.json";
import {
  verifyBattleRecord,
  contradictions,
  type ClaimedBattleRecord,
} from "../ww/battleVerification";

type Pair = { record: ClaimedBattleRecord; account_base64: string };
const pairs = (fixture as { pairs: Pair[] }).pairs;
const bytes = (b64: string) => Uint8Array.from(Buffer.from(b64, "base64"));

describe("verifyBattleRecord, against the real pairs", () => {
  it("has thirty pairs to work with", () => {
    expect(pairs.length).toBe(30);
  });

  it("finds every emitted record chain-consistent", () => {
    const bad = pairs
      .map((p) => ({ id: p.record.battle_id, r: verifyBattleRecord({ record: p.record, account: bytes(p.account_base64) }) }))
      .filter((x) => x.r.verdict !== "chain-consistent")
      .map((x) => ({ id: x.id, verdict: x.r.verdict, why: contradictions(x.r).map((c) => c.field) }));
    expect(bad).toEqual([]);
  });

  it("answers real questions rather than declaring everything unverifiable", () => {
    // A verifier that checks nothing would also report zero contradictions.
    for (const p of pairs) {
      const r = verifyBattleRecord({ record: p.record, account: bytes(p.account_base64) });
      expect(r.answered).toBeGreaterThanOrEqual(10);
    }
  });

  it("leaves most of the record unanswered, and says so", () => {
    const r = verifyBattleRecord({ record: pairs[0].record, account: bytes(pairs[0].account_base64) });
    expect(r.unanswered).toBeGreaterThan(0);
    // The judged winner must never be counted as checked.
    const judged = r.checks.find((c) => c.field === "result_winner");
    expect(judged?.verdict).toBe("unverifiable");
  });
});

describe("the mutations, which are the real test", () => {
  const p = pairs[0];
  const base = () => JSON.parse(JSON.stringify(p.record)) as ClaimedBattleRecord;
  const run = (r: ClaimedBattleRecord) => verifyBattleRecord({ record: r, account: bytes(p.account_base64) });

  it("a wrong battle id is unanchored, not thirty mismatches", () => {
    const r = run({ ...base(), battle_id: 1234567890 });
    expect(r.verdict).toBe("unanchored");
    expect(r.checks).toHaveLength(1);
    expect(r.checks[0].detail).toContain("DIFFERENT BATTLES");
  });

  it.each([
    ["battle_pda", "GvZDKKCY1xgPTSnbNpyfPafgc112SdvCyP4GUVEtsiZ1"],
    ["vault_pda", "BMmGwwDaj4Bjta87nYJwxrWETj6kJrRnmd7b7Gc6StX1"],
    ["artist_a_mint", "6vZaCJyYRxPF1vfxqHCtUaAKwJ3tANJHtFFtjKuTvBL1"],
    ["artist_b_mint", "EC7AeXKyEhvz3exbAUXiTPc62gZzgP9WdxaVs9KQPh71"],
  ])("a forged %s is caught by re-derivation", (field, wrong) => {
    const r = run({ ...base(), [field]: wrong });
    expect(r.verdict).toBe("contradicted");
    expect(contradictions(r).map((c) => c.field)).toContain(field);
  });

  it.each(["start_time", "end_time", "final_supply_a", "final_supply_b", "final_pool_a", "final_pool_b"])(
    "a wrong %s is caught against its offset",
    (field) => {
      const r = run({ ...base(), [field]: 999999999 });
      expect(contradictions(r).map((c) => c.field)).toContain(field);
    },
  );

  it("a flipped settled byte is caught", () => {
    const r = run({ ...base(), settled: !p.record.settled });
    expect(contradictions(r).map((c) => c.field)).toContain("settled");
  });

  it("a flipped settlement winner is caught", () => {
    const flipped = p.record.settlement_winner === "artist_a" ? "artist_b" : "artist_a";
    const r = run({ ...base(), settlement_winner: flipped });
    expect(contradictions(r).map((c) => c.field)).toContain("settlement_winner");
  });

  it("a record from another program is caught, even with everything else right", () => {
    const r = run({ ...base(), program_id: "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYp" });
    expect(contradictions(r).map((c) => c.field)).toContain("program_id");
  });

  it("an absent field is unverifiable, never a mismatch", () => {
    const r = run({ ...base(), end_time: null });
    const c = r.checks.find((x) => x.field === "end_time");
    expect(c?.verdict).toBe("unverifiable");
    expect(r.verdict).toBe("chain-consistent");
  });

  it("a short account is unanchored and says it is not a wrong record", () => {
    const r = verifyBattleRecord({ record: base(), account: new Uint8Array(100) });
    expect(r.verdict).toBe("unanchored");
    expect(r.checks[0].detail).toContain("not a wrong record");
  });
});

describe("the two winners, which a naive verifier would get wrong", () => {
  it("never contradicts a record whose judged winner differs from the settled one", () => {
    // 174 of 1,246 real battles look like this. All must stay clean.
    for (const p of pairs) {
      const settled = p.record.settlement_winner;
      const opposite = settled === "artist_a" ? "artist_b" : "artist_a";
      const r = verifyBattleRecord({
        record: { ...p.record, result_winner: opposite },
        account: bytes(p.account_base64),
      });
      expect(r.verdict).toBe("chain-consistent");
    }
  });

  it("the settled winner is the larger pool in all thirty", () => {
    for (const p of pairs) {
      const r = verifyBattleRecord({ record: p.record, account: bytes(p.account_base64) });
      const inv = r.checks.find((c) => c.field === "invariant:winner_is_larger_pool");
      if (inv) expect(inv.verdict).not.toBe("mismatch");
    }
  });
});
