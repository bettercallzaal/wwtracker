# WaveWarZ standard operating procedures

Every procedure here has been run, on mainnet, with the result recorded. None is
written from how the system is supposed to work.

**Who signs is part of every procedure here.** Anything irreversible, on chain,
or costing money is Zaal's own hand from his own wallet. No lane holds a key or a
funded wallet, and `lib/ww/relayPolicy.ts` refuses to relay `initializeBattle` or
`endBattle` so that a lane cannot settle or launch in anyone's name even by
accident. **Every run note below names the signer.** A procedure that leaves the
hand implied is one somebody will later read as permission.

**The one rule the rest descend from: simulate before you sign.** Every
instruction this estate builds can be asked of the deployed program with
`sigVerify: false` before anyone is asked to approve anything. It costs nothing,
needs no wallet, and returns the program's own words rather than a hex code. A
procedure that skips it is spending fees to produce error messages.

---

## SOP 1 - End a battle the program never settled

**When.** A battle is past its `end_time` and its settled byte is still 0.
Symptoms: a claim against it returns `BattleNotEnded (6009)`, and it shows as
unfinished while wavewarz.info may report `winnerDecided: true` anyway.

**Who can.** Anyone. `endBattle` has seven accounts and **not one is a signer** -
battle, vault, artist A, artist B, the fee wallet, system program, rent. Verified
against a real `endBattle` transaction: its only signer is the fee payer, and
that wallet appears nowhere in the instruction. No admin key is needed.

**Cost.** About 0.000005 SOL in network fees. ~22,000 compute units.

### Procedure

1. **Find them.** `getProgramAccounts` on the program with
   `dataSlice {offset: 0, length: 256}` returns every battle account in one call
   and keeps the payload small. A battle is unended when byte 245 is 0. Reject
   any account whose `battle_id` at offset 8 falls outside 1.6e9..2.6e9 - the
   program owns accounts that are not battles.
2. **Simulate each one first.** Build `endBattle`, serialize with an unsigned
   64-byte signature slot, and call `simulateTransaction` with
   `sigVerify: false, replaceRecentBlockhash: true`. Expect
   `Battle ended successfully` in the logs.
3. **Sign and send from wherever you normally sign.**
   **Not through our relay** - `lib/ww/relayPolicy.ts` deliberately refuses
   `endBattle`, because relaying one would settle a battle in our name. That
   exclusion is correct and is not to be removed for convenience.
4. **Verify from chain, not from the site.** Re-read byte 245 and the vault
   balance. A settled battle's vault drops by the artist payout; a fully claimed
   one sits at the rent floor, 890,880 lamports.

### Run 2026-09-19

**Zaal signed and sent all six himself, from his own wallet**
(`4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk`), on his own initiative - he
opened the request with "I'll go through one by one and end those". The lane's
part was the list, the links, and the six simulations. **This lane holds no key,
can reach none, and wrote nothing to chain.**

That sentence is here because the first draft of this section said only "six
battles ended", and a seat review had to spend a round establishing whose hand
it was. **A procedure that does not name the hand is how the next reader assumes
the lane does it.** Name the signer, every time.

Settled went **1,601 to 1,607**. All six simulated `WOULD SUCCEED` first and all
six landed. The six endBattle signatures are on chain against each battle PDA,
fee payer as above.

**Decide whether it is worth doing before doing it.** At that run, all 93 unended
battles held **0.0944 SOL between them** against 924 SOL of lifetime volume, and
26 of the visible ones held exactly zero - settling those distributes nothing to
anyone. Ending them buys completion and tidiness, not volume or revenue, and
saying so is part of the procedure.

---

## SOP 2 - Claim a settled position

**When.** A wallet holds tokens for a battle whose vault is above the rent floor.

**The two facts must hold together.** Tokens held AND a vault with something
above 890,880 lamports. Tokens against a drained vault is a position whose SOL
has gone; a funded vault with no tokens is somebody else's money. Reporting
either as claimable is how somebody is told they are owed money they already
took.

**And `winnerDecided` is not `settled`.** The public API's judged result and the
program's settled byte are different facts. Battle 1787568630 reported
`winnerDecided: true` while `end_battle` had never run. Check byte 245, not the
API.

### Procedure

1. `GET /api/ww/claimable?wallet=<address>` - reads at request time, no cache.
2. Simulate. Signing is unreachable in the panel until the program says it would
   accept.
3. Sign. `claim_shares` **burns** the tokens, so a zero balance afterwards is the
   confirmation, not a failure.
4. Verify: token accounts read 0, vault at the rent floor.

### Run 2026-09-19

Battle 1787568630 - **Zaal ended it and claimed it himself**, same wallet as
SOP 1. Tokens `0/0`, vault 0.000891 SOL. First end-to-end proof of the signing
path with a real wallet, and the lane's part was the panel and the simulation.

---

## SOP 3 - Check whether the volume bug is live

**Run it.** From `bettercallzaal/wavewarz-protocol`:

```
python3 tools/events-fallback-scan.py
```

**Exits 1 while anything has regressed since its baseline, 0 when clean.**

**The signature.** `volumeSol == poolSol` to 4dp on both sides. A buy puts 98.5%
of its SOL in the pool, so volume and pool should never be equal.

**The floor, which is derived and not chosen.** Below **0.0033 SOL** the 1.5% fee
difference disappears into 4dp rounding and a healthy battle looks affected.
Three of the first sixteen candidates were battles that are fine. **A scan
without the floor sends people after correct data.**

**What it cannot see.** `/api/public/events` serves DECIDED events only, so the
scan covers 172 of 175 main battles and misses the newest. `tools/volume-diff.py`
reads `/api/public/battles`, which has no such filter.

**Done means** it exits 0 on a fresh fetch **and still exits 0 a week later.**
A single clean run proves nothing about a bug whose whole character is recurrence.

---

## SOP 4 - Before reporting any figure

Four rules this estate has paid for, each more than once.

**Feed a filter something it must find, before believing it found nothing.** An
empty grep, an empty result set and a count of zero are the same output whether
the thing is absent or the query is wrong.

**Never read `$?` after a pipe.** The shell reports the last command in the
pipeline, so `cmd | head; echo $?` reports `head`'s status, which is 0 almost
always. Redirect to a file and read the exit directly. Logged three times, every
one of them failing optimistically.

**A total a reader can add up beats a set of independent numbers.** A tool change
once dropped fifteen sections from its own tally and exited 0; it was caught only
because the columns stopped summing to the stated total.

**Say which surface you read, in the sentence carrying the claim.** "Her API says
1,552 battles" and "the program owns 1,694 battle accounts" are both true and
differ by 142.

---

## SOP 5 - When a check and the code disagree

**Suspect the check first.** Measured on this lane: a cross-check reported 29 of
30 battles disagreeing and the fault was the test's own translation layer; a
"not merged" branch audit reported 32 stale branches when squash-merging meant
the real number was 3; an offset documented in one repo was contradicted by 30
real accounts in another.

**A verification that fails on its own mapping is indistinguishable from a real
defect.** Before changing code that has been working, reproduce the disagreement
a second way.

**And a 200 is not a page.** A single-page app returns 200 with the URL echoed
for an id that does not exist. Test a deliberately invalid input: if it behaves
the same, the check proved nothing.

---

## SOP 6 - Handling a public-data disagreement with the platform

**Read their repo first.** `CandyToyBox/wavewarz-intelligence` is public. On
2026-09-18 a full root-cause package was about to be sent for a bug already
described in that repo's own `fix-volume-from-chain.ts`, with the correct fixer
already written and already running nightly. The ask collapsed from a diagnosis
to one question.

**Send what they cannot derive**: the exact rows, values recomputed from chain,
the signature and its floor, and a command that fails while the bug is live.

**Ask one question they can answer from their own logs.** Not "what is wrong" -
"what does the nightly run print for these ids".

**Keep established and open apart.** The mechanism being proven does not make the
trigger proven, and a package that blurs the two invites an argument about the
part that is solid.
