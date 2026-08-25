# WaveWarZ wwtracker - Session Resume Notes (2026-06-17)

Live: https://wwtracker.vercel.app | Repo: github.com/bettercallzaal/wwtracker
Stack: Next.js 14 App Router + recharts. Data baked in public/*.json + lib/*.ts; live Audius/YouTube; one cached Dune balance query.

## What is DONE and LIVE
- Platform Growth = default landing: cumulative contract volume from launch
  (2025-05-26) to today, ~363 SOL buy-side / ~530 both-sides (est.), daily bars,
  BUY-SIDE (exact) / BOTH-SIDES (est.) toggle. Dev wallet demoted to WALLETS group.
- Artist roster expanded 16 -> 33 (from wavewarz.info SSR roster).
- On-chain Analytics tab: live 30-day daily activity chart + per-trader SOL volume board.
- Skips + queue per night: all-time (back to launch). 157 skip nights / 861 skips / 36.7 SOL.
- Battles tab: three-way SKIP / QUEUE / DJ WAVY split (where classified).
- Freshness stamped 2026-06-16.

## What is PENDING / committed locally but NOT pushed
- public/ww-wavysplit.json is at 103 nights (queue 382 / DJ Wavy 31), COMMITTED
  locally (426d4ab) but NOT pushed. Deployed is still 80 nights.
  HOLD ON PUSH: this clone (~/Documents/soltracker) and ~/Desktop/repos/wwtracker
  both point at github.com/bettercallzaal/wwtracker. Settle which clone wins
  before pushing anything from here.
- ~49 busy-month nights (2026-02-17 .. 2026-04-28) still UNclassified for the split.
  Recommendation: deploy the 103 nights as-is; the remaining are a low-event metric
  (DJ Wavy ~31 events total) not worth more credits. Optional to finish later.

## To RESUME
1. Decide which clone is canonical (this one vs ~/Desktop/repos/wwtracker).
2. From the winning clone, push the 103-night split to deploy it.
3. Verify https://wwtracker.vercel.app/?tab=battles shows updated split.
4. (Optional) finish Feb-Apr gap: run /tmp/wavy_3day.py logic in 3-day windows over
   2026-02-15..2026-04-29 using Dune query 7740037. See docs/REFRESH.md "B2".

## DUNE NOTES (important, learned the hard way)
- Current API key is in .env.local (gitignored). Key-handling state is tracked in
  the private tracker; regenerate at dune.com (Settings -> API) when resuming.
- The previous key is credit-capped (HTTP 402) for this billing cycle.
- New account does NOT own old public query 7728208; created fresh query 7740037 to PATCH/execute.
- Free tier = HARD 2-minute execution cap PER query. account_activity joins over a
  big date range exceed it. Must chunk: ~1 week works for normal months, busy
  Feb-Apr 2026 months need 3-DAY windows. Cannot be done in "one or two goes" on
  free tier - that needs a paid tier (lifts the 2-min cap).
- Datapoint cap is per billing cycle; FAILED/timeout queries STILL consume datapoints
  (they scan before failing). The all-time DJ-Wavy backfill burned ~a cycle's worth -
  be frugal: only query missing windows, avoid re-runs.
- Cheap & reliable: single-address scans (FNj inflows -> skips/queue). Expensive:
  any account_activity self-join (sell-side volume, DJ-Wavy classification).

## OPEN QUESTION for Zaal (no credits needed, affects correctness)
Are there payment types to the platform wallet (FNj) beyond skip / queue / DJ Wavy?
Current buckets: 0.005 = queue/DJ-Wavy, 0.015-1.0 SOL = skips. If other paid actions
exist (song submissions, boosts, tips, features), some "skip" numbers are mislabeled.

## NOT feasible on free tier
- Exact per-day BOTH-SIDES sell volume (sellShares join always exceeds 2-min cap).
  Currently shown as a labeled estimate (buy x ~1.49, matches platform's ~484 figure).
  Real version needs a paid Dune tier.
