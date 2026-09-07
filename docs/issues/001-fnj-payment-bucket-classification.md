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

---

## Measured 2026-09-07: the biggest contaminant is not another product charge

Everything above asks whether WaveWarZ **charges** for something else that pays
`FNj`. That is a product question nobody has answered yet, and it turns out not
to be the first question.

`FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37` is not only the wallet that
receives skip and queue payments. **It is also the platform's own trading
wallet** - it appears on the public trader leaderboard, and across the complete
chain scan it holds positions in **1,155 battles with 2,747 trades**, seeding
both sides of battles. `STATE.md` in the protocol repo puts treasury buying at
19.4% of buy value in a recent sample.

So `FNj` receives SOL from the battle program constantly: sell proceeds when it
exits a position, and settlement payouts when a side it held wins. The classifier
looks at amount alone, so any of those landing in `0.015 .. 1.0` is **counted as
a member's skip**.

Measured against the complete scan - 1,643 battles, 15,359 trades - for the
window `ww-skips.json` covers, ending 2026-06-16:

| Inflow to `FNj` from the program | Events in the skip bucket | SOL | Confidence |
|---|---|---|---|
| Its own sell proceeds | 50 | 3.5238 | **MEASURED** |
| Its own settlement payouts | 364 | 14.0119 | **MODELLED** |
| Combined | **414** | **17.54** | |
| Published for that window | 861 skips | 36.6977 | |
| Candidate misclassification | **48% by count** | **48% by value** | |

The settlement leg is modelled, not measured: claim amounts are not carried in
the instruction data, so each payout is attributed from the battle's distribution
by the wallet's share of the winning supply. That model is the one in
`tools/leaderboards.py` and it is labelled as a model everywhere it is used. The
sell leg is exact lamports.

### The calibration night does not clear it either

`docs/REFRESH.md` rests the whole classification on one night, 2026-06-13, where
20 skips / 1.1667 SOL matched. That night:

    FNj battle sells in the bucket          0 events
    FNj settlements in the bucket           4 events, 0.1491 SOL   MODELLED
    published for the night                20 skips, 1.1667 SOL

So even the night that verified the rule carries roughly **20% of its skip count
and 13% of its skip SOL** as candidate treasury inflow. The check passed because
nobody was looking for this - it was looking for a second *product charge*, and
this is not one.

### What this does and does not establish

**It does not prove the figures are wrong.** It depends on whether the Dune query
behind these files counts program-originated inflows at all. If it restricts to
system-program transfers from external signers, none of this lands and the skip
figures are clean. That query has not been read; the rule as documented in
`REFRESH.md` is stated purely as "FNj inflows `0.015 <= amt <= 1.0`", and the
issue above states that amount is the only signal, which is what makes this
plausible enough to measure.

**It does change what to check first.** Question 1 above needs a product answer
from the team and costs a conversation. This one needs no answer from anybody -
it is a filter on a query we own, and the data to test it against is already
committed in the protocol repo at `data/chain-snapshot-2026-09-06`.

### The test that settles it

Take any night in `ww-skips.json` and list the individual `FNj` inflows Dune
counted, with their signatures. Cross-reference the signatures against the
battle program. If any appear, the classifier is counting the treasury's own
proceeds as member spend, and the fix is a source filter rather than a
re-calibration.

Until then, **`861 skips / 36.6977 SOL` is an upper bound on member skip spend,
not a measurement of it**, and it should not be quoted as one. It also must not
be compared against, or added to, the 12.77 SOL of platform queue-jump revenue in
`treasury_fee_events` - those are different quantities over non-overlapping
windows. See the note in `docs/REFRESH.md`.
