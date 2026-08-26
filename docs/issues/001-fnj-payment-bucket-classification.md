# Issue 001: FNj inflow buckets may misclassify non-skip payments as skips

**Status:** open, unfixed. Do not fix without answering the question in
"What we need to know" first - a wrong guess here silently rewrites published
numbers.
**Severity:** correctness. Affects published metrics, not uptime.
**Filed:** 2026-08-25
**Affects:** `public/ww-skips.json`, `public/ww-queue.json`,
`public/ww-wavysplit.json`, the Battles tab, and every "skips / SOL" figure
derived from them.

## The assumption

All per-night skip and queue numbers come from classifying **SOL inflows to the
platform wallet `FNjYtw...kq37` by amount alone**. `docs/REFRESH.md` states the
rule as settled:

- `amt == 0.005` -> queue (or DJ Wavy - the two share a price and cannot be
  separated on-chain)
- `0.015 <= amt <= 1.0` -> skip (the 0.0157 bucket is read as a fee-trimmed 0.02)

Nothing in the query looks at the instruction, the memo, or the program that
produced the transfer. Amount is the only signal.

## Why that may be wrong

The rule is only sound if skips, queue and DJ Wavy are the **only** paid actions
that send SOL to `FNj`. That has never been verified. If WaveWarZ also charges
for song submissions, boosts, tips, features, promos, or anything else that lands
in the same wallet, then:

- any such payment priced in `0.015..1.0` is **counted as a skip**, inflating
  skip counts and skip SOL;
- any such payment priced at exactly `0.005` is **counted as queue**, inflating
  queue and distorting the queue-vs-DJ-Wavy split;
- the error is **silent and cumulative** - it grows with volume and there is no
  internal check that would flag it.

The calibration in `REFRESH.md` was verified against a single night
(2026-06-13: 20 skips / 1.1667 SOL, queue 11). One night matching does not rule
out a second payment type that was simply not exercised that night, or that
launched later.

## Blast radius if the assumption is wrong

- `ww-skips.json`: 157 nights, 861 skips, 36.7 SOL - the headline skip figures.
- `ww-queue.json`: 152 nights.
- `ww-wavysplit.json`: 103 nights, queue 382 / DJ Wavy 31.
- Everything the Battles tab renders from the three-way SKIP / QUEUE / DJ WAVY
  split.

These numbers are published at wwtracker.vercel.app and have been cited as fact.

## What we need to know

1. Does WaveWarZ charge for anything besides skip, queue and DJ Wavy that pays
   `FNj` directly? (Product question - ask the team; costs no Dune credits.)
2. If yes, at what prices, and since when?
3. Do any of those prices collide with `0.005` or fall inside `0.015..1.0`?

## How to check it on-chain

Amount-bucketing is the problem, so the check must not use amounts. Pull the
**distinct instruction discriminators** on transactions that pay `FNj` and see
whether more than the known set appears:

```sql
SELECT to_hex(bytearray_substring(ic.data,1,8)) AS disc, count(*) AS n,
       min(ic.block_date) AS first_seen, max(ic.block_date) AS last_seen
FROM solana.account_activity aa
JOIN solana.instruction_calls ic ON ic.tx_id = aa.tx_id
WHERE aa.address='FNjYtw...kq37' AND aa.balance_change > 0
GROUP BY 1 ORDER BY 2 DESC;
```

A cheaper first pass with no join: histogram the inflow amounts and look for
clusters that do not fit either bucket.

```sql
SELECT round(balance_change/1e9, 4) AS amt, count(*) AS n,
       min(block_date) AS first_seen, max(block_date) AS last_seen
FROM solana.account_activity
WHERE address='FNjYtw...kq37' AND balance_change > 0
GROUP BY 1 ORDER BY 2 DESC;
```

Distinct round-number prices outside `0.005` and the skip ladder are the tell.
Run the histogram first - it is a single-address scan, which is the cheap shape.
The discriminator join is `account_activity` x `instruction_calls`, which is the
expensive shape and needs date windowing on the free tier. See
`docs/REFRESH.md` § C and § B2 for the credit and timeout constraints.

## Notes

- This predates the soltracker -> wwtracker clone consolidation and is present in
  every clone and in the deployed site. It is not a merge artifact.
- Question originally raised in the soltracker working notes (2026-06-17) and
  never answered; recorded here so it stops getting lost between sessions.
