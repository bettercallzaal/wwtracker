# `winnerDecided`, and a correction to what we told you about it

**2026-09-20.** Two things: a correction to our own earlier message that made
our report weaker than the evidence, and a measurement you can reproduce from
your own API in one request per row.

Nothing here needs a reply. If the answer is "known, it is on the list", that
closes it.

## First, we were imprecise, and it mattered

On 2026-09-20 we wrote to you:

> `winnerDecided` and the on-chain settled byte are two different facts and the
> API shows one.

**There is no field called `settled` on the battle account.** We read the
program's IDL properly today: byte 245 is named **`winner_decided`** - the same
name your API uses. The fields are:

    244  winner_artist_a   bool
    245  winner_decided    bool

So these are not two different facts that happen to look alike. **They are the
same field, and they disagree.** Our phrasing let that sound like a definitional
difference, which is a softer and less useful thing to be told. The evidence
supported the stronger claim and we undersold it.

## The measurement

Every battle account on chain, read with `getProgramAccounts`:

| | |
|---|---|
| Battle accounts | **1,694** |
| Past their `end_time` | 1,694 |
| Of those, `winner_decided == 0` on chain | **81** |

Then each of those 81 asked of `https://wavewarz.info/api/public/battles/<id>`:

| | |
|---|---|
| Readable from the API | **40** |
| API says `winnerDecided: true`, chain says false | **22 of 40 (55%)** |
| Agree (both false) | 18 |
| Returned 404 | **41** |

**The 404s are real, not rate limiting.** Three of them were re-requested by
hand, three seconds apart, against a control that returns 200 at the same pace.
All three still 404. So 41 battles that exist on chain and are past their end
time are absent from that endpoint. That may be entirely intended - it is listed
because we could not tell from outside.

The 22 disagreeing ids:

    1759701927  1764804322  1764960393  1765399945  1765402044
    1765405483  1765478216  1766500433  1767339334  1767574093
    1767682691  1780017075  1781140091  1782317161  1782345169
    1782871481  1783112316  1786507547  1786589704  1786712735
    1787882016  1789472805

## Why it is worth an hour

A battle whose `winner_decided` is still 0 has not settled, so **a claim against
it fails with `BattleNotEnded` (6009)**. Somebody who sees "winner decided" on
the site, goes to claim, and gets a rejection has no way to tell that the site
and the chain disagree.

The fix is not on your side necessarily: `endBattle` is permissionless. We
confirmed that against the IDL today rather than only by decoding - **seven
accounts and not one of them is a signer**, so anyone can settle any of these
81 and the disagreement goes away for that battle. Zaal did exactly that for six
of them on 2026-09-19.

## Reproduce

One battle, one request each side:

    curl -s https://wavewarz.info/api/public/battles/1764960393 | jq .winnerDecided

    # byte 245 of the battle account, which the IDL names winner_decided
    # PDA: seeds ["battle", u64_le(battle_id)] under
    # 9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo

All 81 at once, from the program rather than from us:

    getProgramAccounts(programId, {
      filters: [{ dataSize: 353 }],
      dataSlice: { offset: 0, length: 256 },
    })
    // battle_id at offset 8, end_time at 28, winner_decided at 245

## What this does not say

**It does not say your number is wrong and ours is right.** It says the two
disagree on 22 rows and names them. Which one should move is yours to decide;
if the site means "the judges have decided" rather than "the program has
settled", then the field is doing what you intend and only the name collides.

**It does not say the 404s are a bug.** 41 of 81 is a large fraction and we
noticed, so we are telling you. We do not know what that endpoint is meant to
cover.

**It is a point-in-time read.** Taken 2026-09-20. Anyone settling a battle
changes it.
