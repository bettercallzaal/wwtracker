/**
 * PRD 23, the Operator Record: seventeen fields, and an honest account of which
 * of them is measured, which is somebody's decision, and which is a rate
 * nobody charges.
 *
 * THE THIRD CATEGORY IS THE ONE THAT MATTERS AND IT HAS NO PRECEDENT IN THIS
 * LIBRARY. `operator_revenue` and `network_pool_contribution` come from PRD 18
 * and 24: **0.15% of every trade to the originating operator, 0.10% to an
 * Operator Network Pool.** Neither exists on chain. The measured fee is 1.500%
 * split 67/33 between artist and platform, with no operator leg at all, and
 * there is no network pool account.
 *
 * So those two fields are MODELLED, and this module labels them as such rather
 * than returning a number that looks measured. The distinction is the same one
 * `lib/feeModel.ts` draws for launch fees, which are also published and also
 * never collected: **a figure derived from a schedule nobody charges is a model
 * of what would happen, not income.**
 *
 * WHAT IT IS WORTH, SO NOBODY BUILDS A BUSINESS CASE ON IT BY ACCIDENT. The
 * protocol repo computed the direct operator leg across the whole platform:
 * about **1.39 SOL over sixteen months and 1,643 battles**, of which 1.14 SOL
 * would go to WaveWarZ itself because it launched 1,246 of them. Every other
 * launcher combined would receive **0.25 SOL**. That is the size of the
 * incentive PRD 24 describes as rewarding operators for growing the ecosystem.
 *
 * FIVE FIELDS ARE A REGISTRY AND HAVE NO DEFAULTS. `name`, `slug`, `verified`,
 * `verified_at` and `metadata_uri` are decisions somebody makes, exactly like
 * `assetRegistry.ts`'s policy fields, and `buildOperatorRecord` throws rather
 * than inventing them.
 */

/** Rates from PRD 18 and 24. Proposed, and not charged by the program. */
export const PROPOSED_OPERATOR_SHARE = 0.0015;
export const PROPOSED_NETWORK_POOL_SHARE = 0.001;

/** PRD 25: the floor for a period's pool eligibility. */
export const POOL_ELIGIBILITY_MIN_BATTLES = 4;

/** The five a person supplies. None has a default. */
export interface OperatorIdentity {
  operator_id: string;
  name: string;
  slug: string;
  wallet: string;
  verified: boolean;
  /** ISO. Null when not verified, which is a result rather than a gap. */
  verified_at: string | null;
  metadata_uri: string | null;
}

/** What a caller measured from chain and trades. */
export interface OperatorActivity {
  battlesStarted: number;
  battlesCompleted: number;
  uniqueArtists: number;
  uniqueTraders: number;
  lifetimeVolumeLamports: number;
  /** 1.005% of volume, the artist leg of the measured fee. */
  artistFeesGeneratedLamports: number;
  /** Earliest battle this operator started, ISO. */
  createdAt: string | null;
}

export interface OperatorRecord extends OperatorIdentity {
  created_at: string | null;
  battles_started: number;
  battles_completed: number;
  unique_artists: number;
  unique_traders: number;
  lifetime_volume_lamports: number;
  artist_fees_generated_lamports: number;
  /**
   * MODELLED, NOT EARNED. PRD 18's 0.15%, applied to measured volume. The
   * program pays no operator leg, so this is what an operator WOULD have
   * received under that schedule.
   */
  operator_revenue_lamports_modelled: number;
  /** MODELLED. PRD 24's 0.10%. There is no network pool account on chain. */
  network_pool_contribution_lamports_modelled: number;
  /** PRD 25. Null when the caller gave no period to judge. */
  pool_eligible: boolean | null;
  supported_tokens: string[];
  sources: Record<string, string>;
}

const IDENTITY_FIELDS: Array<keyof OperatorIdentity> = [
  "operator_id",
  "name",
  "slug",
  "wallet",
  "verified",
];

export class IncompleteOperatorIdentity extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `cannot build an operator record: ${missing.length} identity field(s) missing - ${missing.join(", ")}. ` +
        "These are registry decisions, not defaults; supply them or do not create the record.",
    );
    this.name = "IncompleteOperatorIdentity";
  }
}

/** Which identity fields are absent. `false` and empty strings are present. */
export function missingIdentityFields(id: Partial<OperatorIdentity> | null | undefined): string[] {
  if (!id) return IDENTITY_FIELDS.map(String);
  return IDENTITY_FIELDS.filter((f) => id[f] === undefined || id[f] === null).map(String);
}

export function buildOperatorRecord(p: {
  identity: Partial<OperatorIdentity>;
  activity: OperatorActivity;
  /** Battles completed in the period being judged, for PRD 25. Omit to skip. */
  battlesCompletedInPeriod?: number;
  supportedTokens?: string[];
}): OperatorRecord {
  const missing = missingIdentityFields(p.identity);
  if (missing.length) throw new IncompleteOperatorIdentity(missing);
  const id = p.identity as OperatorIdentity;
  const a = p.activity;

  if (id.verified && id.verified_at == null) {
    throw new Error(
      "an operator marked verified must carry verified_at: a verification with no date " +
        "cannot be re-checked, and 'verified at some point' is the claim that ages worst",
    );
  }

  return {
    ...id,
    verified_at: id.verified_at ?? null,
    metadata_uri: id.metadata_uri ?? null,
    created_at: a.createdAt,
    battles_started: a.battlesStarted,
    battles_completed: a.battlesCompleted,
    unique_artists: a.uniqueArtists,
    unique_traders: a.uniqueTraders,
    lifetime_volume_lamports: a.lifetimeVolumeLamports,
    artist_fees_generated_lamports: a.artistFeesGeneratedLamports,
    operator_revenue_lamports_modelled: a.lifetimeVolumeLamports * PROPOSED_OPERATOR_SHARE,
    network_pool_contribution_lamports_modelled:
      a.lifetimeVolumeLamports * PROPOSED_NETWORK_POOL_SHARE,
    pool_eligible:
      p.battlesCompletedInPeriod === undefined
        ? null
        : p.battlesCompletedInPeriod >= POOL_ELIGIBILITY_MIN_BATTLES,
    supported_tokens: p.supportedTokens ?? [],
    sources: {
      battles_started: "chain: battles whose creating signer is this operator's wallet",
      battles_completed: "chain: of those, the ones whose settled byte is set",
      lifetime_volume_lamports: "derived from supplied trades; this library does not fetch them",
      artist_fees_generated_lamports:
        "derived: 1.005% of volume, the artist leg of the measured 1.500% fee split 67/33",
      operator_revenue_lamports_modelled:
        "MODELLED from PRD 18's proposed 0.15%. The program pays NO operator leg - this is what " +
        "would be earned under that schedule, not income. Across the whole platform the leg is " +
        "about 1.39 SOL over sixteen months, of which 1.14 would go to WaveWarZ itself",
      network_pool_contribution_lamports_modelled:
        "MODELLED from PRD 24's proposed 0.10%. There is no network pool account on chain",
      pool_eligible:
        "PRD 25: at least 4 completed battles in the period. Null when no period was given - " +
        "an unjudged operator is not an ineligible one",
      verified: "registry: a person's decision, never derived from activity",
      supported_tokens:
        "registry: every battle to date settles in SOL and the program cannot settle anything else",
    },
  };
}

/** Both modelled legs for a volume, for a caller comparing scenarios. */
export const modelOperatorEconomics = (volumeLamports: number) => ({
  operatorLamports: volumeLamports * PROPOSED_OPERATOR_SHARE,
  networkPoolLamports: volumeLamports * PROPOSED_NETWORK_POOL_SHARE,
  note: "both proposed in the PRD and neither charged by the program",
});
