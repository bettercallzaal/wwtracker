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
// A HAZARD THE CONVENTION CREATES, and the finance lane put it better than I did.
//
// Naming a price basis makes an error catchable by a reader WHO CHECKS. It does
// nothing on a page nobody checks, and it actively helps a wrong number look
// rigorous: "~$167K at $180/SOL" reads MORE trustworthy than "~$167K", precisely
// because it shows its working.
//
// So showing your working can make a wrong number more persuasive. That is not a
// caveat on the convention, it is a hazard the convention creates. Naming the
// basis is necessary and not sufficient. The sufficient half is a test - which is
// why lib/__tests__/solPrice.test.ts asserts a single definition and a plausible
// band, rather than trusting the annotation to protect anyone.
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
