# Launch fees: measured, not modelled

`lib/feeModel.ts` carries a 0.69 SOL quick-battle launch fee and a 4 SOL
community-battle launch fee. Both come from the documented fee schedule.

**Neither is being collected.** Measured on mainnet 2026-09-06.

---

## What was measured

Twenty battle-creation transactions, found by deriving each battle's PDA and
walking its signature history to the transaction whose logs contain
`Program log: Instruction: InitializeBattle`. Reproduce with
`scripts/scan-launch-fees.py`.

For each one, the treasury wallet's lamport balance before and after the
creation transaction:

| Treasury balance change at creation | Battles |
|---|---|
| Received 0.69 SOL | **0** |
| Received 4 SOL | **0** |
| Received anything at all | **0** |
| Paid out about 0.0039 SOL | 16 |
| Unchanged | 4 |

The four unchanged are the battles created by someone other than the treasury.

## The money moves the other way

Creating a battle costs the creator about **0.0039 SOL**: rent for the four
accounts a battle needs - the Battle PDA, the vault, and both artist mints -
plus transaction fees.

**The creator pays it, whoever they are. 20 of 20.** Treasury-created battles
are paid for by the treasury; the three created by other wallets were paid for
by those wallets.

At roughly 0.0039 SOL across 1,501 battles, about **5.9 SOL has been spent
creating battles**, against 12.77 SOL of lifetime treasury fee events reported
by the indexer. Creation costs are on the order of half of gross fee income.

## Why this matters beyond bookkeeping

**The WBS-1 partner economics are drawn from the wrong pool.** The PRD proposes
splitting the 0.5% platform trade fee three ways, giving an originating operator
0.15%. Across the platform's entire history that is about 1.4 SOL. If launch
fees had been collected they would have dwarfed the trade fee; they were not, so
the trade fee really is the revenue line, and it is very small.

Any proposal that offers a partner a share of trading needs to survive that
number before it is presented to a partner.

**But there is a working primitive here that the PRD does not mention.**
Operators already pay for the battles they create. It is small and it is rent
rather than a fee, but the mechanism exists on chain today and needs no program
change: whoever creates a battle bears its cost. A standard that wants operators
to carry their own weight is not starting from zero.

## What this does not tell you

Whether launch fees were ever charged historically, or are charged by a path
that does not touch the treasury wallet inside the creation transaction. The
sample is twenty recent battles. A full-history scan would settle it, and the
indexer does not track launch fees at all, so chain is the only source.

Whether 0.0039 SOL is the whole cost. Rent is refundable when accounts close,
so if battle accounts are ever closed after settlement some of it comes back.
Nothing here checked for that.
