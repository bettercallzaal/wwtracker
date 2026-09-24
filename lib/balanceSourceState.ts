/**
 * WHY THE TREASURY CHART IS NOT SHOWING LIVE NUMBERS, in words, on the page.
 *
 * Zaal ruled on 2026-09-23 that the Dune trial should be allowed to lapse and
 * that "the page should admit it". This is that. The trial's billing period
 * ends 2026-09-24 with 34 of 2500 credits used, so the data stops refreshing
 * and the failure has to be visible where a reader is, not in a log.
 *
 * WHAT IT WAS DOING INSTEAD. `BalanceDashboard` had four outcomes and three
 * labels. A 503, an empty result and a thrown error ALL set the status to
 * `sample` and drew `sampleBalances()` - invented numbers on a chart. The one
 * piece of information that distinguished them, the error text, was stored in
 * an `errorMsg` state variable that **no part of the component ever rendered**.
 * So a dead data source and a deliberately unconfigured one were the same
 * screen, which is this repo's oldest defect shape wearing a badge.
 *
 * THE THREE FACTS, kept apart because they call for different actions:
 *
 *   - NOT CONFIGURED (503): there is no Dune key here. Sample data is honest;
 *     nothing is broken and nobody needs to do anything.
 *   - EMPTY: the source answered and had nothing to say. That is a real
 *     answer about the treasury, not a fault.
 *   - FAILED: the source could not be reached or refused us. **Sample numbers
 *     must not stand in for this.** Somebody has to know.
 *
 * A LAPSED SUBSCRIPTION IS NAMED SPECIFICALLY. Dune answers 401 or 402 when
 * the plan will not cover a request, and "HTTP 402" tells a reader nothing.
 * Since we know the trial was left to lapse on purpose, that case says so.
 */

export type BalanceSourceState = "live" | "not-configured" | "empty" | "failed";

export interface BalanceSource {
  state: BalanceSourceState;
  /** One sentence for the page. Empty only when the state is `live`. */
  message: string;
  /** May the chart draw invented rows. False whenever something is actually wrong. */
  sampleIsHonest: boolean;
}

/**
 * Decide from what the fetch produced.
 *
 * `httpStatus` is null when the request never completed - a network failure or
 * a thrown parse - which is a failure, not an absence.
 */
export function balanceSource(input: {
  httpStatus: number | null;
  rowCount: number;
  error?: string | null;
}): BalanceSource {
  const { httpStatus, rowCount, error } = input;

  if (httpStatus === null) {
    return {
      state: "failed",
      message: `The treasury source could not be reached${error ? `: ${error}` : ""}. The figures below are sample data, not the treasury.`,
      sampleIsHonest: false,
    };
  }

  // 503 is this app saying "no Dune key here", which is a configuration fact
  // rather than a fault, and the sample chart is the point of it.
  if (httpStatus === 503) {
    return {
      state: "not-configured",
      message: "No treasury data source is configured here, so the chart below is sample data.",
      sampleIsHonest: true,
    };
  }

  // Dune refuses with 401 or 402 when the plan will not cover the request.
  // Named, because "HTTP 402" sends a reader looking for a bug that is not one.
  if (httpStatus === 401 || httpStatus === 402 || httpStatus === 403) {
    return {
      state: "failed",
      message:
        "The treasury data subscription is no longer accepted (HTTP " +
        httpStatus +
        "). The Dune trial was allowed to lapse on 2026-09-24, so these numbers are sample data and will not refresh until it is renewed.",
      sampleIsHonest: false,
    };
  }

  if (httpStatus >= 400) {
    return {
      state: "failed",
      message: `The treasury source answered HTTP ${httpStatus}${error ? `: ${error}` : ""}. The figures below are sample data, not the treasury.`,
      sampleIsHonest: false,
    };
  }

  // A successful response with nothing in it is a real answer about the
  // treasury, and it is NOT the same as a broken source.
  if (rowCount === 0) {
    return {
      state: "empty",
      message: "The treasury source answered with no rows, so there is nothing to chart yet.",
      sampleIsHonest: true,
    };
  }

  return { state: "live", message: "", sampleIsHonest: true };
}

/** The badge, so the label and the sentence cannot disagree. */
export function balanceBadge(state: BalanceSourceState): string {
  if (state === "live") return "LIVE";
  if (state === "not-configured") return "SAMPLE";
  if (state === "empty") return "NO DATA";
  return "SOURCE DOWN";
}
