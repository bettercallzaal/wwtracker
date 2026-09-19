# The volume field and the pool field, 2026-09-19

Written for Candy, who maintains `wavewarz.info` and its public API.

This is one question with its evidence attached, put in a file rather than a
long message so it can be read once and checked against your own logs. Nothing
here needs a reply in any particular form.

## The question

**What does the nightly `fix-volume-from-chain.ts` run print for these four
battle ids?**

```
1757207855
1758505532
1760666134
1762740734
```

That is the whole ask. If the fixer wrote the values below, it is reading pool
where it means volume. If the fixer did not touch them, something downstream is
writing that field after it, and the fixer being correct does not help. Only
your logs can tell those apart.

## What is established

Four settled battles lost reported volume between two scans, with no trading
activity on them in months.

```
battle        volume before      volume now
1757207855    0.4658 / 2.2240    0.0503 / 0.0012
1758505532    1.4559 / 0.8499    0.1817 / 0.2220
1760666134    0.2400 / 0.6211    0.2364 / 0.3913
1762740734    0.4577 / 0.7516    0.1179 / 0.0831
```

That is 5.78 SOL of reported volume, and **volume that decreases on a settled
battle cannot be right in any accounting** - nothing can un-trade. Lifetime
volume on `/api/public/stats` moved 924.99 to 921.99 SOL across the same window,
which nets out once real new trading is counted.

**The part that identifies the mechanism is visible in your own API response.**
`/api/public/events` returns `artist1PoolSol` and `artist1VolumeSol` as separate
fields. For all four, today, those two fields are identical to each other, and
both equal the bonding-curve pool in a chain snapshot taken on 2026-09-06 -
thirteen days before these values changed.

```
battle        pool field        volume field      chain pool 6 Sept
1757207855    0.0503 / 0.0012   0.0503 / 0.0012   0.0503 / 0.0012
1758505532    0.1817 / 0.2220   0.1817 / 0.2220   0.1817 / 0.2220
1760666134    0.2364 / 0.3913   0.2364 / 0.3913   0.2364 / 0.3913
1762740734    0.1179 / 0.0831   0.1179 / 0.0831   0.1179 / 0.0831
```

Eight values, three ways, all matching to four decimal places. A buy puts 98.5%
of its SOL into the pool, so volume and pool cannot be equal on a battle that
had real trading. **Something is writing the pool into the volume field.**

Re-checked at 21:39 UTC on 2026-09-19: all four still hold.

## What is open, and kept separate on purpose

**Which component writes it.** The mechanism above is established. The trigger
is not, and this note does not claim otherwise - that is the question at the
top.

**How far it reaches.** `/api/public/events` serves decided events only, so this
covers 173 rounds. Four is a floor, not a total. Across everything visible from
outside, 15 battles carry the same signature. You can see the rest.

## Two smaller notes, neither of them asks

**`winnerDecided` and the program's settled byte are different facts.** Battle
1787568630 reported `winnerDecided: true` while `end_battle` had never run on
chain. This is the same shape as the comment in your webhook handler about
`winner_decided` sitting at false forever, from the other direction.

**Six battles were settled on 2026-09-19.** Zaal ended six battles that the
program had never settled, and claimed one. Settled went 1,601 to 1,607. All six
were past their end time with the settled byte still 0, so a claim against any
of them returned `BattleNotEnded`. `end_battle` is permissionless - seven
accounts, none a signer - so this needed no admin key and nothing from your
side. Mentioned only because it moves a number you report.

## How to reproduce any of this

The scan that finds the signature, from `bettercallzaal/wavewarz-protocol`:

```
python3 tools/events-fallback-scan.py
```

It exits 1 while anything has regressed since its baseline and 0 when clean.
It applies a floor of 0.0034 SOL per side, below which the 1.5% fee difference
disappears into 4dp rounding and a healthy battle looks affected. **A scan
without that floor sends people after correct data**, which is how three of the
first sixteen candidates turned out to be fine.

The chain pools come from a full read of the program's battle accounts,
1,643 of them, stored as `data/chain-snapshot-2026-09-06/census.json` in the
same repo. They are read from the program, not from your API, which is what
makes the three-way match meaningful.
