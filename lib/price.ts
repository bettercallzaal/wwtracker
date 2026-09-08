// SOL/USD reference price for approximate USD display. THE ONLY definition in
// this repo - lib/measured.ts re-exports this one rather than carrying its own.
//
// It had a second definition until 2026-09-08, and they disagreed by 77%: this
// file said 101.9 and lib/measured.ts said 180, both stamped 2026-09-05. The 180
// was never measured, it was typed, in the file whose entire purpose is that
// figures are measured. It shipped "~$167K at $180/SOL" onto the case-study page
// when the honest figure was ~$96K - a 74% overstatement in a block called
// CITABLE_FACTS.
//
// The convention half-saved it: naming the price basis in the copy is what makes
// the error catchable by a reader. Naming a basis you did not measure is what
// made it wrong in the first place.
//
// Measured against the platform's own reported price:
//   zao-measure --verify "wwtracker: SOL price basis"
//
// RE-CHECK BY 2026-10-08. A price is the most perishable number here, and every
// USD figure in this repo derives from this one line.
export const SOL_USD = 103.34;
export const SOL_USD_AS_OF = "2026-09-08";

/** Format a SOL amount as an approximate USD string, e.g. "≈ $247". */
export function usd(sol: number, dp = 0): string {
  const v = sol * SOL_USD;
  return `≈ $${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`;
}
