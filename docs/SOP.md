# WaveWarZ standard operating procedures

Every procedure here has been run, on mainnet, with the result recorded, **except
SOP 8, which says so in its first line.** None is written from how the system is
supposed to work.

That exception is carried in the open rather than quietly. A file whose rule is
"everything here has been run" stops being checkable the moment one entry has
not, unless the entry and the header both say which one.

**Who signs is part of every procedure here.** Anything irreversible, on chain,
or costing money is Zaal's own hand from his own wallet. No lane holds a key or a
funded wallet, and `lib/ww/relayPolicy.ts` refuses to relay the LAUNCH
instructions, `initializeBattle` and `initializeMints`, so that a lane cannot
launch a battle in anyone's name even by accident.

**`endBattle` was on that refused list until 2026-09-21 and is not any more.**
It is relayable now, deliberately, because the operator page needs it: the
instruction names seven accounts and **not one is a signer**, it pays nothing to
whoever sends it, and the wallet at the other end is the only thing that signs.
Relaying it cannot settle a battle "in our name" because there is no name on it.
The refusal that matters - the launch instructions - is unchanged. This
paragraph said otherwise for two days after the code changed, which is why the
change is spelled out here rather than quietly edited. **That holds even though the SDK now BUILDS both instructions** - see
SOP 8. Handing a front end bytes for its own user to sign is not the same act as
putting them through our key, and the refusal is about the key.

**Every run note below names the signer.** A procedure that leaves the
hand implied is one somebody will later read as permission.

**The one rule the rest descend from: simulate before you sign.** Every
instruction this estate builds can be asked of the deployed program with
`sigVerify: false` before anyone is asked to approve anything. It costs nothing,
needs no wallet, and returns the program's own words rather than a hex code. A
procedure that skips it is spending fees to produce error messages.

**And it needs no credential either.** Every simulation in this file works
against `https://api.mainnet-beta.solana.com`, the free keyless public endpoint.
The keyed `SOLANA_RPC_URL` buys rate limits and reliability for the site, not
access to this. **Recorded because a session on 2026-09-20 hit a permission
refusal reading that key and reported itself blocked on simulating** - it was
never blocked, it had reached for the expensive door first. If a check here
appears to need a secret, check whether the public endpoint answers it before
saying so.

**Ask simulation for the post-state, not just the verdict.** `simulateTransaction`
takes `accounts: { encoding: "base64", addresses: [...] }` and hands back the
accounts as they WOULD be. That turns "would this succeed" into "what exactly
would it write", which is how SOP 8's duration trap was caught: the call
succeeds either way, and only the written account tells them apart.

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

**Check the whole plan before signing any of it.**
`npx tsx scripts/ww-settle-dry-run.ts` packs every unsettled battle into
transactions and simulates each one against the program - no wallet, no
`WW_OPERATOR`, nothing signed, because `endBattle` names no signer and
`sigVerify: false` needs none. Run 2026-09-23: 82 battles in 11 transactions,
**11 of 11 would succeed**, 1,069,773 compute units across the run. A batch
that would fail is worth knowing about before you are standing in front of a
wallet approving eleven things.

It is a simulation against the chain as it is now. If somebody settles one of
these in between, that batch fails and `/operator` stops and re-reads, which is
what it was built to do.

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
3. **Sign and send from wherever you normally sign.** Since 2026-09-21 the
   relay accepts `endBattle` too, so `/operator` can send it - the wallet that
   signs is still yours, and the instruction names no signer and pays the sender
   nothing. What the relay still refuses is the launch pair,
   `initializeBattle` and `initializeMints`, and that refusal is not to be
   removed for convenience.
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

---

## SOP 8 - Launch a battle

**EVERY STEP BELOW HAS BEEN RUN EXCEPT THE SIGNING, WHICH IS ZAAL'S.** That is
the one exception this file's header names. No lane holds a key, so no lane has
sent one of these.

**Two independent verifications, and they check different things.**

**The encoding, against a real launch, byte for byte.** Battle 1788580997's own
`initializeBattle` transaction was read back from chain on 2026-09-20 and
`initializeBattleInstruction` rebuilds its 32 data bytes and all eight accounts
exactly. A confirmed mainnet transaction, not a simulation.

**The behaviour, against the deployed program.** Simulated on 2026-09-20:
`err: null`, 18,620 compute units, a 353-byte account at the predicted PDA, and
the program's own log line *"Battle initialized with ID 1789936271 starting at
1789936271"*. The post-state account was captured and is asserted in
`lib/__tests__/wwInitializeSimulation.test.ts`.

**Neither is a run.** What remains unexercised is one signature.

**Who can.** Anyone. The single signer is whoever pays the rent. The transaction
this was decoded from was signed by **Zaal's own wallet**
(`4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk`), not by a platform key, which
settles the question from the chain side. Zaal ruled the same thing in words on
2026-09-20: anyone can launch a battle, anyone can build a front end.

**Cost.** Rent on two new accounts, roughly 0.004 SOL, plus network fees. **The
published launch prices are not charged by the program** - 20 creations were
inspected on chain on 2026-09-06 and the platform's fee wallet received nothing
in any of them. See `lib/feeModel.ts`. Whatever 0.69 and 4 SOL are, they are not
this instruction.

### Two more traps, found by simulating rather than by reasoning

**`minTokensOut` of 0 is REJECTED.** The obvious way to say "no slippage limit"
is the one value the program refuses, with `InvalidAmount (6006)`. Pass 1.
`buySharesInstruction` and `sellSharesInstruction` now refuse 0 with that
reason rather than letting it fail on chain as a number.

**A battle is not tradeable the instant it starts, because the chain's clock
lags.** `BattleNotActive (6003)` on a launch-and-buy whose start time was
seconds in the past, and the same call succeeded when the start was further
back. The clock sysvar measured 10 seconds behind wall time in one reading and
the effective boundary moved between runs. **Set the start time from the chain's
clock, not the machine's**, or launch a minute ahead of the first trade.

### The two traps in the arguments

**The middle argument is a DURATION, in seconds. The account stores an END
TIME.** The program adds; it does not store. **This was measured, not reasoned
about.** An end time passed as a duration was simulated against the deployed
program on 2026-09-20: it returned `err: null`, consumed **the same 18,620
compute units** as the correct call, logged the same cheerful
*"Battle initialized"*, and produced a battle ending in **2083** - 56.7 years
long.

**Nothing stands between a caller and that outcome except the parameter name.**
There is no validation, no warning, and no difference in cost or logs to notice
it by. `initializeBattleInstruction` names the field `durationSeconds` for this
reason alone, and the trap has its own test rather than its own sentence.

**The battle id IS the start time, in unix seconds.** Not an index, not a
counter. Every battle on chain satisfies `battle_id == start_time`, which is why
discovery's id guard is a date range. A small integer derives a perfectly
well-formed PDA for a battle that can never exist.

### Procedure

1. **Choose the id as the start time.** Unix seconds, now or later. Both PDAs
   derive from it, so it cannot be changed afterwards.
2. **Check the PDA is empty first.** `getAccountInfo` on `battlePda(id)`. A
   used id fails at send with an account-already-in-use error, and finding that
   out for free is the point of this step.
3. **Build it** with `initializeBattleInstruction`, passing the duration in
   seconds and the three wallets. Start time defaults to the id, which is what
   every real launch does.
3b. **Create the mints, in the same transaction.** `initializeMintsInstruction`,
   no arguments, any payer. **A battle without mints cannot be traded** - there
   is nothing for `buyShares` to mint into, and the page is dead. Simulated
   2026-09-20: battle alone returns `err: null` and the mint account does not
   exist; battle plus mints returns two 82-byte SPL mints owned by the token
   program, 43,179 compute units for the pair.

   **This instruction was missing from this estate entirely until 2026-09-20,**
   and it was found by counting rather than by reading: 200 real program
   transactions sampled and bucketed by discriminator, of which 7.5% were an
   instruction nothing here could build. Everything else about launching had
   been verified byte for byte, and the gap was a whole step, not a detail.
4. **Simulate before signing**, as SOP 1 does: `sigVerify: false`,
   `replaceRecentBlockhash: true`. Expect `Battle initialized with ID <id>
   starting at <id>` and about 18,600 compute units. **Ask for the post-state
   account back too** - `accounts: { encoding: "base64", addresses: [battlePda(id)] }` -
   and run step 6's subtraction on it before anyone signs anything. The whole
   check then costs nothing and happens before the mistake instead of after.
5. **Sign and send from your own wallet.** **Not through our relay.**
   `lib/ww/relayPolicy.ts` refuses `initializeBattle`, and that exclusion stays
   even though the SDK now builds the instruction for anyone who asks. Building
   a transaction for a front end's user to sign and relaying one through our key
   are different acts; only the second launches a battle in our name.
6. **Verify from chain.** Re-read the battle account: 353 bytes, `battle_id` at
   offset 8, `start_time` at 20, `end_time` at 28. Confirm
   `end_time - start_time` equals the duration you passed. That single
   subtraction catches the duration trap above, and it is why it is a step.

**Trader token accounts are a third thing, and are NOT the mints.** Step 3b
creates the battle's two mints. The ASSOCIATED TOKEN ACCOUNTS a trader holds
them in are created by the trader's own first transaction - the program does
not make those, which cost an earlier session an afternoon to establish. See
`traderTokenAccountInstructions`. Conflating the two is what hid step 3b for as
long as it was hidden.

---

## SOP 7 - Auditing the branch trail

**When.** Before anyone deletes branches, and any time the question "did we lose
work on a branch" comes up. Run 2026-09-19 over 235 remote branches; full result
in [BRANCH-AUDIT.md](BRANCH-AUDIT.md).

**The two tests that do NOT answer it.**

`git merge-base --is-ancestor` reports every squash-merged branch as unmerged.
Measured on this repo: 32 branches reported stale, real answer 3.

"Does the branch differ from `main`" is worse, because it reports **yes for
every old branch whether it merged or not** - `main` has moved on regardless.
Measured: 181 of 235. A cleanup driven by that number puts 181 branches in front
of a person and teaches them the audit is noise.

**The test that does.** Which paths did the branch ADD that `main` has never
carried, at any point in its history:

```
base=$(git merge-base main "$ref")
git diff --name-status --diff-filter=A "$base".."$ref" \
  | while read st f; do git cat-file -e "main:$f" 2>/dev/null || echo "$f"; done
```

**The `2>/dev/null` is not decoration.** Without it `git cat-file` prints
`fatal: path '...' does not exist in 'main'` to stderr for every orphan it
finds, interleaved with the answers, and the output reads like the command is
broken at exactly the moment it is working. This SOP shipped without it and a
reader copying the block got one fatal per result.

235 branches down to 74, and 65 distinct paths - a list a person can read.

**It flags candidates, not losses.** A file renamed on `main` looks identical to
a file lost on a branch. `docs/CLONE-AUDIT.md` came back as an orphan and is
alive on `main` as `docs/archive/2026-08-25-duplicate-clone-check.md`. Check
each one before acting on it, and when you write the check up, **name the file a
reader can actually open** - "under `docs/archive/`" sends them looking for a
name that is not there, which is the same wrong turn the test itself exists to
prevent.

**Not merging is often the right answer, and an audit that calls every unmerged
branch "lost work" invites somebody to rebuild it.** 45 components sit only on
the July `feat/wave*` branches. They work and they read live data.

**Read the pull request comments before concluding anything about why a branch
stopped.** That audit went through three versions of one paragraph. First it
said the components were dropped because they duplicate wavewarz.info -
inference, never recorded, believed because it matched the repo's thesis. Then
it said the reason was unrecorded - declared after searching `docs/` and commit
messages only. **Then someone opened the PRs: 51 of 53 carry a Vercel free-tier
failure, "more than 100 deployments per day", and 52 of the closures fall on two
days.** They ran out of deployments, and no hosted preview was ever built for
most of them.

Then a review could not reproduce 53 and 51, because the paragraph gave counts
without the rule that selected them - and measuring the obvious rule,
`feat/wave*`, returns a different and smaller set. **Publish the selector beside
any count somebody might re-run**; `docs/BRANCH-AUDIT.md` now carries both
commands.

Three lessons from one paragraph. **An inference that agrees with the house view
gets committed without a source.** **An absence declared after one search is a
claim, not a finding** - "nothing in the history says why" needs the searches
named, or it is just where you happened to look. And **a count without its
selector cannot be checked, only believed.**

**Rescue with the re-check attached, never the file alone.** The one document
worth recovering carried a headline finding - "V2 average volume is 58% lower
than V1" - that reversed sign when re-measured against the chain census. It was
brought back with the contradiction at the top and the original body untouched.
**A two-month-old finding restored without re-checking is a false fact with a
fresh commit date on it.**

---

## SOP 9 - Run a battle night

**Run on 2026-09-21 (first end-to-end trades) and rehearsed on 2026-09-23.** The
sequence below is what produced the recorded battles in `var/ww-live` and the
first trades signed through our own widget. It existed only as comments in
`scripts/ww-night.sh` and as messages in a chat until now, which is why two of
its three tools were broken for days without anyone noticing.

**Who signs:** Zaal, from his own wallet, for anything that moves. Everything
below is read-only except the trades and claims he chooses to make.

### Before the session

```bash
cd ~/Desktop/repos/wwtracker
git pull --ff-only origin main
scripts/ww-night.sh rehearse   # the marker and the report, actually run
scripts/ww-night.sh start      # watcher + built server on :3520
```

**Rehearse before ready, and treat a FAIL as blocking.** `ready` checks that
processes are up; `rehearse` checks that the night's own tools work. On
2026-09-22 `ready` passed while `ww-45s-report.ts --marks FILE` was silently
reading a different file and the report's battle window could not reach a
session from the previous evening. Both had been broken for days. A tool that
runs once a week is a tool nothing exercises.

`start` rebuilds only when `HEAD` differs from `var/built.sha`, and leaves a
running watcher alone.

### During the session

- **A second terminal for the marks:** `scripts/ww-mark.sh`. Type `announce`
  and press Enter the moment the host says the round is open; type `sent` when
  the wallet confirms a trade. Nothing else is needed - every line is stamped
  from the same clock the watcher uses.
- **The page to watch:** `http://localhost:3520/battle/latest`. It redirects to
  the newest recorded battle and reloads every five seconds. If it says it
  cannot read the store, that is this machine, not the battle.
- **The watcher heartbeat** is `var/ww-live-watch.log`. Read `scans`, not
  `polls`: `polls` only moves while a battle is open, so on a quiet stretch it
  sits still and looks dead. `retries` rising is the early warning that the RPC
  is pushing back; `dropped reads` are samples that are not in the chart.

### After

```bash
npx tsx scripts/ww-45s-report.ts        # the announcement lag, from the marks
npx tsx scripts/ww-night-record.ts --out ~/zao-vault/projects/ww-night-$(date +%F).md
```

Both take their window from the marks' own time span, so running them the next
morning works; with no marks they fall back to a clock window and say which
they used.

The **report** answers one question: how long after the host said "open" did
the chain actually open. The **record** is everything else the night left
behind - per battle, its clock, how much of it the samples cover, every
observed pool move, the largest increase, what moved in the final minute, and
whether the program has settled it.

**Read the coverage line before quoting anything from the record.** It is the
share of the battle the samples actually span, and below 90% the record says so
in bold, because a write-up built from half a battle should not read like a
record of the battle. And a pool series is READINGS, not trades: two trades
between two polls read as one move, which is why nothing in either output
counts trades.

### What the night is supposed to produce

One `var/ww-live/<battleId>.jsonl` per battle, a marks file under
`~/zao-vault/projects/`, and the report's lag figures. **The 45-second
announcement lag has never been measured** - the marks have never been typed
during a live session - so the number that would settle the fairness question
with Hurricane is still UNKNOWN, not small.
