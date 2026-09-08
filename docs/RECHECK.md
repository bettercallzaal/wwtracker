# Time-bound claims, and when each stops being trustworthy

Every claim here is about something outside this repo's control - a key, a
service, a setting another lane owns, a deadline. Those go stale silently, and a
record that stays loud after it stops being true is as dangerous as an alarm that
goes quiet when things break.

**This file is enforced, not trusted.** `scripts/validate.mjs` scans every tracked
file for `RE-CHECK BY YYYY-MM-DD`, warns inside seven days, and **fails under
`--strict`** once the date passes. CI runs `--strict`. So a stale claim breaks the
build rather than sitting here being read.

It also warns if it finds *no* markers at all - a repo with no dated claims is
far likelier to have lost the convention than to genuinely have none.

The convention came from five instances in a single day, 2026-09-08: a protocol
recorded as live that was not, an application drafted against a closed cycle, a
VPS marked down that had been up for sixteen days, doc summaries contradicting
their own bodies, and superseded pages with nothing marking them. The rule was
"write a re-check date next to the claim". Written down, that is honor-system, and
the estate's own measurement is that honor-system rules run at 3-40% against
~100% for structurally enforced ones. Hence this.

---

## The claims

### The Helius RPC key is disclosed and deliberately not rotated

`/api/ww/positions` published `SOLANA_RPC_URL` - a keyed endpoint - in its own
`source` field from 2026-09-06 until PR #245 closed it. The leak is fixed. The
key was rotated on 2026-09-08 after being found, but **the old key was left live
on purpose**: Zaal's call was to defer deletion until after the Grand Final,
because that budget is what keeps `/live` up and a rotation going wrong during the
event is the worse risk.

Two things follow, and both need doing rather than remembering:

- delete the old key, and confirm it returns 401
- create a **second** key so the scan tooling stops sharing a budget with the
  production page - `WW_RPC_RPS` is 6 only because they share one

**RE-CHECK BY 2026-09-14**

### The ~20k/day Helius usage threshold is a per-key derivation

`/api/ww/positions` revalidates every 20s and makes at most 5 Helius calls per
cache miss, so our own ceiling is about 21,600 requests a day under continuous
load. That number was given as the line between "somebody took the disclosed key"
and "nobody did".

**It is per-key, and the dashboard's reporting scope is unknown.** If Helius
reports account-level and another project shares the account, the comparison
includes traffic that is not ours and fails in the direction that *hides* a theft.
`wavewarzapp` was measured on 2026-09-08 and defines no environment variables at
all, so it is not a contributor - but that was one project of 35+.

**RE-CHECK BY 2026-09-14**

### The three skip/queue datasets are knowingly parked

`public/ww-skips.json`, `ww-queue.json` and `ww-wavysplit.json` are exempt from
the strict staleness gate via `KNOWN_STALE` in `scripts/validate.mjs`. They are
also an **upper bound rather than a measurement**: `FNj` is both the skip-payment
wallet and the platform's trading wallet, so its own sell proceeds and settlement
payouts land in the skip amount bucket. See `docs/issues/001`.

**RE-CHECK BY 2026-10-15**

### Anything measured from chain

`lib/measured.ts` carries `MEASURED_ON`. Figures move as battles settle. The file
says how to regenerate rather than adjust, and the tests fail if a surface
disagrees with it - so this one is already structural and needs no date.
