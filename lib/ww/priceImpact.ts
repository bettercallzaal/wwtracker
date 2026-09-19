/**
 * PRD section 56's last requirement: what a trade does to the price, and the
 * refusal when that is more than somebody allowed.
 *
 * WHAT PRICE IMPACT IS HERE, AND WHAT IT IS NOT. It is the adverse gap between
 * the price at the margin before the trade and the average price the trade
 * actually gets, caused by the trade's own size moving along the curve. It is
 * NOT the 1.5% buy fee and it is NOT slippage.
 *
 * Those three are separate on purpose, and the PRD agrees: section 16's registry
 * carries `maximum_price_impact` and `maximum_slippage` as different fields.
 * Slippage is the gap between what you expected and what you got because the
 * world moved while you waited; price impact is the gap you cause yourself and
 * can know before you sign; the fee is a fixed cut. Folding the fee into impact
 * would make every small buy read as 1.5% impact, which would be a number about
 * the fee schedule wearing the name of a risk measure.
 *
 * So impact is computed on POOL prices, with the fee excluded and reported
 * separately by `quoteBuy`.
 *
 * THERE IS NO DEFAULT THRESHOLD, and that is the same stance as the asset
 * registry and the slippage floor. `maximum_price_impact` is a policy field a
 * person sets, in basis points, per asset. A hardcoded fallback here would be a
 * limit nobody chose that looks exactly like one somebody did - and unlike a
 * missing slippage floor, which merely fails open, a wrong impact limit fails
 * in whichever direction happens to be wrong for the trade in front of it.
 *
 * WHEN NO LIMIT IS SUPPLIED, the impact is still COMPUTED and reported, and the
 * absence of a limit is reported with it. Silence would be the one outcome worth
 * avoiding: a caller must be able to tell "checked and fine" from "not checked".
 */
import { CURVE_K } from "./quote";

/**
 * Lamports per token at the margin, for a pool of this size.
 *
 * The curve is `supply = sqrt(K x pool)`, so `pool = supply^2 / K` and the
 * marginal price is `d(pool)/d(supply) = 2 x supply / K = 2 x sqrt(pool / K)`.
 * An empty pool has no meaningful price, and returning 0 rather than NaN keeps
 * the comparison below arithmetic rather than a special case.
 */
export function spotPricePerToken(poolLamports: number): number {
  if (poolLamports <= 0) return 0;
  return 2 * Math.sqrt(poolLamports / CURVE_K);
}

/**
 * The adverse price move a trade causes itself, in basis points.
 *
 * Always non-negative. Moving along a convex curve is adverse in both
 * directions - a buyer pays more per token than the spot price, a seller
 * receives less - and a threshold wants a magnitude, not a sign. Direction is
 * the caller's own business and it already knows which one it asked for.
 *
 * Returns 0 rather than Infinity when there is no price to move from. An empty
 * pool is the first trade, which has nothing to be compared against, and
 * reporting Infinity would make every opening trade fail a threshold.
 */
export function priceImpactBps(p: {
  poolBeforeLamports: number;
  /** Lamports that actually entered or left the POOL, fee excluded. */
  poolDeltaLamports: number;
  /** Tokens received or sold, in base units. */
  tokens: number;
}): number {
  const spot = spotPricePerToken(p.poolBeforeLamports);
  if (spot <= 0 || p.tokens <= 0) return 0;
  const effective = Math.abs(p.poolDeltaLamports) / p.tokens;
  const impact = Math.abs(effective - spot) / spot;
  return Math.round(impact * 10_000);
}

export interface PriceImpactAssessment {
  impactBps: number;
  /** The configured limit, or null when nobody configured one. */
  limitBps: number | null;
  /**
   * True only when a limit existed AND the impact is within it. Never true for
   * an unchecked trade - "we did not look" must not read as "it is fine".
   */
  withinLimit: boolean;
  /** True when a limit existed at all, so a caller can render the difference. */
  checked: boolean;
  exceeded: boolean;
}

/**
 * Assess an impact against a limit that may not exist.
 *
 * The three states are deliberately distinguishable: within a limit, over a
 * limit, and never checked. A boolean would collapse the third into one of the
 * first two, and it would collapse it into the reassuring one.
 */
export function assessPriceImpact(
  impactBps: number,
  limitBps: number | null | undefined,
): PriceImpactAssessment {
  const limit = limitBps === undefined || limitBps === null ? null : limitBps;
  if (limit === null) {
    return { impactBps, limitBps: null, withinLimit: false, checked: false, exceeded: false };
  }
  const exceeded = impactBps > limit;
  return { impactBps, limitBps: limit, withinLimit: !exceeded, checked: true, exceeded };
}

/**
 * Thrown instead of building a trade that moves the price further than allowed.
 *
 * PRD 56: "Transactions outside configured safety limits should fail rather than
 * execute at unreasonable prices." Failing means not producing the transaction,
 * not producing it with a warning attached - a warning is something a caller can
 * ignore, and an ignorable limit is not a limit.
 */
export class PriceImpactExceededError extends Error {
  constructor(
    public readonly impactBps: number,
    public readonly limitBps: number,
  ) {
    super(
      `price impact ${(impactBps / 100).toFixed(2)}% exceeds the configured maximum of ` +
        `${(limitBps / 100).toFixed(2)}%. Trade a smaller size, or change the limit deliberately.`,
    );
    this.name = "PriceImpactExceededError";
  }
}

/** For a UI. States the limit, or states that there is not one. */
export function describePriceImpact(a: PriceImpactAssessment): string {
  const impact = `${(a.impactBps / 100).toFixed(2)}%`;
  if (!a.checked) {
    return `${impact} price impact. No maximum is configured for this asset, so nothing was checked against.`;
  }
  const limit = `${(a.limitBps! / 100).toFixed(2)}%`;
  return a.exceeded
    ? `${impact} price impact, over the ${limit} maximum.`
    : `${impact} price impact, within the ${limit} maximum.`;
}
