# The WaveWarZ ecosystem, measured

Everything learned about WaveWarZ as a business and a body of history, in one
place. The protocol layer - what the Solana program does, byte by byte - lives in
`bettercallzaal/wavewarz-protocol`. This is the other half: the record book, the
growth history, the second product, and the things that are true about WaveWarZ
that are not properties of a program.

**Measured 2026-09-06, with a dated delta at section 0 from 2026-09-19.** Every figure states its source and sample. Where a
number is inherited from somebody else's data rather than measured, it says so.

---

## 0. What has changed since, re-measured 2026-09-23

**Everything below this section is stamped 2026-09-06 and is left exactly as it
was.** The 09-23 column was added the same way: a new column, nothing rewritten. Re-writing those figures without re-deriving each one is the thing this
document's own header warns against, so the movement is recorded here instead and
the original measurement stays legible.

| | 2026-09-06 | 2026-09-19 | 2026-09-20 | 2026-09-23 | |
|---|---|---|---|---|---|
| Battle accounts on chain | 1,643 | 1,694 | 1,694 | **1,702** | +8 in three days; "flat since" was true when written and is not now |
| Settled on chain | - | 1,607 | 1,613 | **1,620** | |
| Never ended, past their clock | - | 87 | 81 | **82** | one more than on 09-20: last night's tie, 1790042941 |
| In her public listing | 1,501 | 1,552 | 1,558 | **1,566** | the gap to chain is now 136, unchanged |
| Lifetime volume, her API | 922.3 SOL | 921.99 SOL | | **954.49 SOL** | +32.5 SOL since 09-19, and it is rising again after the drop |
| Artist payouts | 14.38 SOL | 14.47 SOL | | **14.95 SOL** | |
| Trader claims | - | 481.76 SOL over 3,368 withdrawals | |
| SOL still sitting in pools | - | **494.39 SOL** | |

**THE VOLUME FIGURE IS FALLING, AND THAT IS NOT POSSIBLE HONESTLY.** Lifetime
trading volume cannot decrease - it is a sum over trades that already happened.
It read 924.99 SOL on the morning of 2026-09-19 and 921.99 SOL a few hours later,
and it now sits below the 922.3 SOL this document measured thirteen days ago.

The cause is known and is not a measurement error on our side. Fifteen battles
currently serve their POOL value in place of their trading volume - the signature
is `volumeSol == poolSol` to 4dp on both sides - which erases **16.34 SOL** of
real volume from the public total. That was 11.84 SOL on 2026-09-18. See
`bettercallzaal/wavewarz-protocol`, `recon/VOLUME-FALLBACK-COMPLETE-2026-09-17.md`
and `tools/events-fallback-scan.py`, which exits non-zero while it is happening.

**So any volume figure quoted from the public API today is low, by a growing
amount.** The 922.3 SOL below was correct when measured and is now higher than
what the API reports, which is the wrong way round and is the tell.

## 1. The ecosystem, in one table

| Product | What it is | Chain | Live since | Scale today |
|---|---|---|---|---|
| **WaveWarZ** | two-sided, time-boxed song battles that settle to a winner | Solana | 2025-05-26 | 1,643 battles, ~$97k lifetime volume |
| **WaveZStation** | one-sided, open-ended fan pools on a single song | Base | 2026-07-26 | 8 songs, 244 USDC gross |
| **$ongChainn** | catalogue and audience, the reference arena | Base / Farcaster | proposed as an arena | not yet integrated |

Three surfaces, three chains' worth of identity, and one set of artists moving
between them with no shared record. That gap is the thing worth building.

---

## 2. WaveWarZ: sixteen months of history

### 2.1 The trajectory

| Period | Battles | Per month | Pool | New artists |
|---|---|---|---|---|
| Months 1-6 | 154 | 25.7 | 33.05 SOL | 35 |
| Months 7-12 | 852 | 142.0 | 125.02 SOL | 58 |
| Months 13-16 | 637 | 127.4 | 331.77 SOL | 27 |

Battle count grew 5.5x, then stopped. Money per battle kept rising. New-artist
acquisition halved.

### 2.2 The number that decides everything

| | |
|---|---|
| Distinct artist wallets, ever | **120** |
| Active in exactly one month | **63 (52%)** |
| Active six or more months | 18 |
| Active twelve or more months | **1** |
| Top 10 share of all appearances | 55.7% |

Sixteen months produced 120 competitors, half of whom never came back, and one
who lasted a year.

### 2.3 What happened when artists ran out

Self-battles - one artist's two tracks against each other - were 0-12% of battles
for the first five months and have run 25-46% since, as new-artist acquisition
fell. Stated as a hypothesis rather than a cause, but it fits: with a fixed
roster the only way to grow battle count is more battles per artist.

**430 of 1,643 battles (26%) are an artist against themselves.** 403 appear in
the public API as ordinary battles. Any artist win/loss record that counts them
gives an artist both a win and a loss for beating themselves.

### 2.4 Money, honestly

| | Lifetime | Annualised |
|---|---|---|
| Trading volume | 922.3 SOL / $96,943 | $72,707 |
| Artist earnings on chain | 14.38 SOL / $1,511 | ~$727 |
| Platform fee at 0.50% | ~4.6 SOL / ~$485 | **~$364** |
| Volume per battle | 0.6145 SOL | **$64.59** |

41.5% of that volume predates 2026-04-27 and rests on a backfill nobody has
independently reconstructed. Do not cite it as verified.

---

## 3. The record book

Computed, not curated. Every entry is a query over the 1,643 accounts.

| Record | Value |
|---|---|
| First battle ever | `1748233241`, 2025-05-26 04:20:41 UTC |
| Biggest pot | **97.10 SOL**, battle `1784509679`, 2026-07-20, LUI vs GEEK MYTH |
| Deepest rivalry | **87 meetings** between two wallets |
| Second, third rivalry | 41, 34 meetings |
| Closest finish | battle `1762984750`, margin 0.0000% |
| Longest win streak | 14 |
| Most upset wins | 20, then 12, 11, 11, 9 |
| Battles that are a rematch | **873 of 1,643** |
| Distinct match-ups | 340, of which 59 have met five or more times |
| Decided by under 1% of the pot | 39 |
| Decided by over 90% | 313 |

### The biggest battle moved a month

97.10 SOL against a lifetime average of 0.30 SOL, and it is **40% of everything
traded in July 2026** - the month that reads as 5x growth. Any chart that shows
July as a trend is showing one battle.

### The upset is the platform's best untold story

The chain settles to the larger pool. The announced result comes from judges -
**2-of-3 for quick battles, a panel of three humans for main events**, confirmed
by Zaal 2026-09-20. So the two disagree, and the artist the money was against
wins more often than anyone says.

**142 of 1,205 battles, 11.8%.** By type: quick **10.1%**, community 16.7%, and
main events **21.1%** - one in five of the curated events goes against the pool.

**Say the denominator, because this document has carried three numbers for one
fact.** It previously said 189 of 1,265, and other notes have said 174 of 1,246.
They are the same measurement counted three ways:

| Denominator | Disagreements | Rate |
|---|---|---|
| Settled battles with unequal pools | 142 of 1,205 | **11.8%** |
| All settled battles with a recorded winner, counting the 41 tied-pool battles as disagreements | 183 of 1,246 | 14.7% |

**The first is the honest one.** Where both pools are equal the money expressed
no preference, so the judges cannot have overruled it, and folding those 41 in
inflates the rate by three points.

Nothing anywhere surfaces any of it.

---

## 4. WaveZStation

The second product, and the more interesting one commercially.

### 4.1 What it is

A fan pays what they want into a song. Every sale splits three ways, and earlier
contributors earn proportionally when later fans buy the same song. No opponent,
no deadline, no settlement.

### 4.2 Verified on chain, per transaction

Contract `0x6EEe0a8ebd1446a3a77a8F720bF37232fD88b255` on Base, in USDC.

    1.0000 USDC   buyer     -> contract
    0.4500 USDC   contract  -> creator wallet      45%
    0.1000 USDC   contract  -> platform wallet     10%
    (0.4500 remains as the fan pool)               45%

Stated in their docs, exposed as on-chain config in their API
(`wavestation_fan_pct_bps: 4500`), and executed visibly by the contract. Three
sources, the third a stranger's block explorer.

### 4.3 Activity

129 USDC transfers, 2026-07-26 to 2026-09-06.

| | |
|---|---|
| Gross sales | **244.00 USDC** |
| To the platform wallet | **24.40 - exactly 10.00%** |
| To creators and claimants | 114.96 across 10 addresses |
| Retained in pools | 104.64 (42.88%) |
| Distinct buyers | **8** |
| Largest buyer | 150.00 USDC - 61% of all volume |
| Songs / artists | 8 / 6 |
| `claimRewards` calls | 6 |

### 4.4 The comparison that should change planning

Normalised per week over each product's own lifetime:

| | WaveWarZ | WaveZStation |
|---|---|---|
| Gross per week | ~$1,393 | ~$41 |
| Platform revenue per week | ~$6.97 | **~$4.07** |
| Take rate | 0.50% | **10.00%** |

**Six weeks old, under 3% of the volume, roughly 58% of the platform revenue.**

The take rate is 20x because a sale commission and a trading fee are different
instruments. This is not an argument for raising the battle fee - 10% on a trade
kills a bonding curve. It is an argument that a **sale** is a better commercial
event than a **trade**, and the ecosystem's revenue thinking has been anchored to
the wrong one.

### 4.5 The overlap nobody has connected

Six artists have songs on WaveZStation: Hurric4n3Ike, STILOWORLD, r3plic4nt,
GodclouD, NEMESIS, S.R.Chappell. At least three compete on WaveWarZ.

They are the same people, with Ethereum wallets on one product and Solana wallets
on the other, and nothing joins the two records. An artist's WaveZStation
supporters and their WaveWarZ career are two halves of one thing, stored as
strangers.

---

## 5. What this says to build

In order of leverage, and none of it needs a program change.

1. **A canonical song id across both products.** The unit is the song in both -
   26% of battles are track-vs-track by one artist, and WaveZStation has no other
   unit. One id turns two databases into one artist page. Spec is in
   `wavewarz-protocol/spec/TRACK-IDENTITY.md`.
2. **A cross-chain artist identity.** Farcaster verifications carry both
   `PROTOCOL_SOLANA` and `PROTOCOL_ETHEREUM`, so one Farcaster account can prove
   ownership of both wallets. That is the bridge, it is signed rather than
   asserted, and it is already measurable.
3. **Surface the derived lore.** 189 upsets and 873 rematches are in the data
   now, unlabelled. Cheapest possible way to make the record worth reading.
4. **Fix the artist leaderboard.** It counts self-battles.
5. **Instrument artist retention.** 52% one-month churn is the number the company
   lives on and it is not on any dashboard.

---

## 6. How to check any of this

The protocol repo carries `VERIFY.md`, which gives at least two independent
sources for every claim plus explorer links that need no code.

WaveZStation specifically:

    curl -s "https://www.wavezstation.com/api/songs" | python3 -m json.tool
    https://base.blockscout.com/address/0x6EEe0a8ebd1446a3a77a8F720bF37232fD88b255

**One caution learned the hard way today.** WaveZStation's own API has
`pool_address: null` on every song, and Base Blockscout's `/counters` endpoint
reports `transactions_count: 0` for a contract that has 129 token transfers. Two
different sources both said "nothing here" about a contract that was transacting
that morning. Read the transfers, not the summary field.
