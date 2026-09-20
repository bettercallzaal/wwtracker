/**
 * PRD 23, 24 and 25.
 *
 * The assertions worth reading are the ones about the two MODELLED fields.
 * Every other record in this library separates measured from supplied; this is
 * the first that has to separate measured from "a rate nobody charges", and a
 * number in a revenue field is the easiest thing in the world to quote.
 */
import { describe, expect, it } from "vitest";
import {
  IncompleteOperatorIdentity,
  POOL_ELIGIBILITY_MIN_BATTLES,
  PROPOSED_NETWORK_POOL_SHARE,
  PROPOSED_OPERATOR_SHARE,
  buildOperatorRecord,
  missingIdentityFields,
  modelOperatorEconomics,
  type OperatorActivity,
} from "../ww/operatorRecord";

const identity = {
  operator_id: "wavewarz",
  name: "WaveWarZ",
  slug: "wavewarz",
  wallet: "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37",
  verified: true,
  verified_at: "2026-09-20T00:00:00.000Z",
  metadata_uri: null,
};
const activity: OperatorActivity = {
  battlesStarted: 1246,
  battlesCompleted: 1200,
  uniqueArtists: 52,
  uniqueTraders: 157,
  lifetimeVolumeLamports: 760_857_682_603,
  artistFeesGeneratedLamports: Math.round(760_857_682_603 * 0.01005),
  createdAt: "2025-05-26T00:00:00.000Z",
};

describe("identity is a registry, not a derivation", () => {
  it("refuses to build without it, naming every missing field", () => {
    expect(() => buildOperatorRecord({ identity: {}, activity })).toThrow(IncompleteOperatorIdentity);
    expect(missingIdentityFields({})).toEqual(["operator_id", "name", "slug", "wallet", "verified"]);
  });

  it("treats verified:false as present, not missing", () => {
    // The most likely value for a new operator. A falsy check would reject it.
    expect(missingIdentityFields({ ...identity, verified: false })).toEqual([]);
  });

  it("refuses a verified operator with no verification date", () => {
    expect(() =>
      buildOperatorRecord({ identity: { ...identity, verified_at: null }, activity }),
    ).toThrow(/cannot be re-checked/);
  });

  it("allows an unverified operator with no date", () => {
    expect(() =>
      buildOperatorRecord({ identity: { ...identity, verified: false, verified_at: null }, activity }),
    ).not.toThrow();
  });
});

describe("the two modelled fields, which are the point", () => {
  const r = buildOperatorRecord({ identity, activity });

  it("names them modelled in the field name itself, not only in a note", () => {
    // A caller destructuring this cannot accidentally get a field called
    // `operator_revenue`; the name carries the caveat.
    expect(r).toHaveProperty("operator_revenue_lamports_modelled");
    expect(r).toHaveProperty("network_pool_contribution_lamports_modelled");
    expect(r).not.toHaveProperty("operator_revenue");
    expect(r).not.toHaveProperty("network_pool_contribution");
  });

  it("says in the sources that the program pays no operator leg", () => {
    expect(r.sources.operator_revenue_lamports_modelled).toMatch(/program pays NO operator leg/);
    expect(r.sources.network_pool_contribution_lamports_modelled).toMatch(/no network pool account/);
  });

  it("uses the PRD's two different rates, which are separate legs", () => {
    // 0.15% to the operator and 0.10% to the pool are not the same number and
    // collapsing them would understate or overstate one of them.
    expect(PROPOSED_OPERATOR_SHARE).toBe(0.0015);
    expect(PROPOSED_NETWORK_POOL_SHARE).toBe(0.001);
    expect(r.operator_revenue_lamports_modelled).toBeCloseTo(activity.lifetimeVolumeLamports * 0.0015, 0);
    expect(r.network_pool_contribution_lamports_modelled).toBeCloseTo(activity.lifetimeVolumeLamports * 0.001, 0);
  });

  it("produces the figure the protocol repo measured, to the SOL", () => {
    // 760.86 SOL of launched volume at 0.15% is ~1.14 SOL, which is what
    // operator-attribution.py computed for this wallet.
    expect(r.operator_revenue_lamports_modelled / 1e9).toBeCloseTo(1.141, 2);
  });
});

describe("pool eligibility, PRD 25", () => {
  it("is null when no period was given, not false", () => {
    // An unjudged operator is not an ineligible one.
    expect(buildOperatorRecord({ identity, activity }).pool_eligible).toBeNull();
  });

  it("is true at the threshold and false below it", () => {
    expect(POOL_ELIGIBILITY_MIN_BATTLES).toBe(4);
    const at = buildOperatorRecord({ identity, activity, battlesCompletedInPeriod: 4 });
    const below = buildOperatorRecord({ identity, activity, battlesCompletedInPeriod: 3 });
    expect(at.pool_eligible).toBe(true);
    expect(below.pool_eligible).toBe(false);
  });
});

describe("the scenario helper", () => {
  it("returns both legs and says neither is charged", () => {
    const m = modelOperatorEconomics(1_000_000_000);
    expect(m.operatorLamports).toBe(1_500_000);
    expect(m.networkPoolLamports).toBe(1_000_000);
    expect(m.note).toMatch(/neither charged by the program/);
  });
});

describe("supported tokens", () => {
  it("defaults to empty rather than assuming SOL", () => {
    // Every battle settles in SOL, but that is a fact about the program, not a
    // declaration this operator has made.
    expect(buildOperatorRecord({ identity, activity }).supported_tokens).toEqual([]);
  });
});
