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

**RE-CHECKED 2026-09-17: STILL OPEN, and the date moving is not progress.**
Production is healthy - `/api/ww/positions?battleId=1789184502` returns
`status: live` with no `UNAUTHORIZED`, so the key production runs on is intact.
Neither remaining step has happened. Both are Zaal's hands at
`dashboard.helius.dev` and neither is checkable from here by design: confirming
the old key returns 401 means using a disclosed secret, which this lane does not
do.

One thing that changed since 09-14 and is worth recording: the local check that
used to confirm step 5 - reading the mtime of `~/.zao/private/wavewarz.env` - is
now refused by this machine's permission layer. So the evidence for "not done"
is weaker than it was, not stronger. It is inference from nobody reporting it
done, rather than a file timestamp.

**INVALIDATED BY:** Zaal deleting the disclosed key and creating `wwtracker-scans`.
**RE-CHECK BY 2026-10-17** - a month, because four re-checks have now moved this
date without the work moving, and a shorter interval has only ever produced
another date change.

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

**RE-CHECKED 2026-09-17: the uncertainty is unchanged, and that is the finding.**
Nothing has established the dashboard's reporting scope, so the comparison is
still capable of failing in the direction that hides a theft. No new measurement
was available: the scope question can only be answered at the Helius dashboard,
which is Zaal's.

Relevant and NOT the same thing: Candy hit `429 max usage reached` on her own
Helius plan between 09-11 and 09-16 (wavewarz-protocol #28), which left 21 battles
unhydrated until she fixed the billing. That is her account, not ours, and it is
recorded here only so a later reader does not mistake it for evidence about this
threshold. It says nothing about our key.

**INVALIDATED BY:** anyone establishing whether Helius reports per-key or
per-account. **RE-CHECK BY 2026-10-17.**

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
