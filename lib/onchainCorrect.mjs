// The one correction for public/ww-onchain-daily.json, shared by the browser
// read (lib/onchainDaily.ts) and the build (scripts/ww-gen.mjs).
//
// Plain ESM on purpose, like lib/liveWatch.mjs: ww-gen.mjs is a node script and
// cannot import TypeScript, and the last time the build carried its OWN copy of
// a correction, the copy and the read drifted (AUDIT 3.8, 2026-09-09). One
// module, two importers.
//
// THE DUNE FILE IS WRONG TWO WAYS in its buy / sell / claim columns, both
// measured against the complete chain scan (wavewarz-protocol
// data/chain-snapshot-2026-09-06):
//
// 1. `sells` and `claims` are TRANSPOSED. 259 of 330 days hold the swap, 22 the
//    straight reading. Found 2026-09-08.
//
// 2. It counts FAILED transactions. Found 2026-09-10, closing the residual 3.8
//    left open. Dune was higher than chain on every day the two disagreed and
//    lower on none, so it is not a day-boundary effect, which would cancel. On
//    16 days (12 drawn at random, 5 of them days that agree) the failed buy
//    instructions on the battle vaults equal Dune's buy excess exactly, and
//    failed sells + claims equal its sells + claims excess exactly. 16 of 16.
//    Lifetime: 349 failed buys, 91 failed sells, 21 failed claims - 440 failed
//    attempts rendered as trades, "12,408 trades" against 11,968.
//
// So those three columns now come from the chain scan itself, per day, via
// public/ww-chain-daily.json (tools/chain-daily.py, offline). Dune stays the
// source for everything the scan does not cover, and is CHECKED against it:
// lib/__tests__/onchainDaily.test.ts asserts Dune is never below chain on a
// complete day, which is the relationship the finding rests on.
//
// `txs`, `traders`, `created`, `settled`, `minted` still come from Dune. `txs`
// almost certainly includes failed transactions too; how many is UNMEASURED.

/** Buy / sell / claim from chain; the Dune excess kept as `failedAttempts`. */
export function correctDay(d, c) {
  const chain = c ?? { buys: 0, sells: 0, claims: 0 };
  // Dune with its transposition undone - what it claims happened.
  const dune = { buys: d.buys, sells: d.claims, claims: d.sells };
  return {
    ...d,
    buys: chain.buys,
    sells: chain.sells,
    claims: chain.claims,
    failedAttempts:
      dune.buys - chain.buys + (dune.sells - chain.sells) + (dune.claims - chain.claims),
  };
}

/**
 * Correct every row. Refuses a Dune day the chain file does not cover rather
 * than fall back to Dune's count for it: that fallback is the bug.
 */
export function correctDays(rows, chainDaily) {
  if (!chainDaily || !Array.isArray(chainDaily.days)) {
    throw new Error("ww-chain-daily.json missing or malformed - refusing to render failed attempts as trades");
  }
  const late = uncoveredDays(rows, chainDaily);
  if (late.length) {
    throw new Error(
      `ww-chain-daily.json covers to ${chainDaily.measuredThrough} but the Dune file runs to ${late.at(-1)} - regenerate it with wavewarz-protocol tools/chain-daily.py`,
    );
  }
  const byDate = new Map(chainDaily.days.map((r) => [r.date, r]));
  // A covered day with no chain row had no successful trades - zero, not missing.
  return rows.map((d) => correctDay(d, byDate.get(d.date)));
}

/** Dune days past the chain file's coverage. */
export function uncoveredDays(rows, chainDaily) {
  return rows.filter((d) => d.date > chainDaily.measuredThrough).map((d) => d.date);
}
