# Launching the first battle of our own

Written 2026-09-26, before it has been done once. Every number here was measured
on this machine on that date, and the two places where nothing has been measured
say so instead of guessing.

**Nothing in this file is a trade recommendation.** It is an operating procedure
for a protocol test. What to buy and how much is not addressed and is not ours to
address.

## What is already true before you start

- The launch path is proved in simulation and nothing is signed. Launch, mints,
  two token accounts, buy A, buy B and sell A ran as **one transaction**, 8
  instructions, 202,638 compute units, `err: null`, against mainnet.
- `endBattle` **takes no signer at all**. Anyone can end any battle past its
  clock; you are only paying the fee. That is why 81 battles sit unended.
- Launching is **permissionless**. The program does not check who you are.
- A **half-launch cannot happen from our page**. `launchBattleInstructions`
  returns both instructions and `LaunchBattle.tsx` puts them in one message, so
  the transaction's atomicity means both land or neither does. 39 battles on
  chain are half-launched - an account with no mints, unusable forever, rent
  stranded - and every one of them was created by something that sent the two
  instructions separately.

## Step 1 - the flag

```bash
grep -c '^WW_LAUNCH=1' ~/Desktop/repos/wwtracker/.env.local    # want: 1
```

**If it prints 0:**

```bash
printf '\nWW_LAUNCH=1\n' >> ~/Desktop/repos/wwtracker/.env.local
```

The flag gates `/launch`, the launch actions on `POST /api/ww/trade`, and the
relay's willingness to forward a launch instruction. It carries no
`NEXT_PUBLIC_` prefix, so it never reaches the browser.

## Step 2 - the server

```bash
cd ~/Desktop/repos/wwtracker
kill -- -$(cat var/server.pid); rm -f var/server.pid; scripts/ww-night.sh start
```

The kill is not optional. `ww-night.sh start` refuses to act if `:3520` already
answers, so without it you get "server already answering" and the old build
keeps serving.

**Success:** `server: 200 on :3520`, then a ready check whose every line reads
PASS, including `the Announce button really works (GET /api/ww/mark answered
200)`.

**On `BUILD FAILED, see var/build.log`:** read the log, and look at the FIRST
error rather than the last. A Turbopack error naming `app/layout.tsx` and a
Google font is a corrupt `.next` cache, not a code fault and not the network:

```bash
mv .next .next.broken && npm run build      # 13 seconds when this was the cause
```

**A failed build deletes `.next/BUILD_ID`,** so the old server cannot restart
either. Build before concluding the server is the problem. Delete
`.next.broken` afterwards; it was 506 MB.

## Step 3 - confirm what the flags actually did

```bash
for p in /launch /api/ww/mark /battle/latest; do
  printf '%-18s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3520$p)"
done
```

**Success:** 200, 200, 200.

**On `/launch` 404 with the flag set:** the running process predates the code.
Repeat step 2.

**A 404 never means forbidden here.** Every flag in this repo 404s when off, on
purpose, so an outsider cannot tell a disabled page from a missing one. That also
means a flag being off and a route being broken look identical from outside,
which is exactly how `/api/ww/mark` stayed dead for six sessions while the ready
check reported PASS. If a route 404s, check both.

## Step 4 - the page

```bash
open http://localhost:3520/launch
```

Connect Phantom. Four fields:

| field | what to put | why |
|---|---|---|
| Artist A wallet | an address you control | it receives artist fees, and you want both sides |
| Artist B wallet | a **different** address you control | same side twice is one wallet's battle with itself |
| Starts in (minutes) | `2` | see the gate below |
| Runs for (minutes) | `10` | long enough to buy both sides without rushing |

The platform fee destination is `wavewarzWallet`, set per battle at
initialisation and currently the WaveWarZ treasury. That is a decision already
taken, not an oversight.

**The page quotes the cost before you sign.** It is rent on four accounts - the
battle account, the vault, and two mints - plus the network fee. If the cluster
does not quote a fee, the total is shown as a **floor** and says so; it never
silently treats an unknown fee as zero. None of it is refundable.

**Success:** Phantom shows one transaction. Sign it. The page gives you a battle
id, which is simply the start time in unix seconds.

**On a send that hangs:** the relay forwards through the public RPC, because
`SOLANA_RPC_URL` is unset. The public endpoint is rate-limited and can time out.
Retrying is safe: the battle id makes the account address deterministic, so a
retry either creates the battle or finds it already there.

**"Sent" is not "landed".** A signature means a node accepted the broadcast. The
route waits about 20 seconds on `getSignatureStatuses` and reports landed,
failed, or unknown - and unknown is never shown as failure, because somebody
told a trade failed might send it twice.

## Step 5 - verify on chain, not on the page

```bash
cd ~/Desktop/repos/wwtracker && npx tsx scripts/ww-watch-ours.ts <battleId>
```

**Success looks exactly like this:**

```
  account      EXISTS, 353 bytes, 0.00xxxx SOL rent
  vault        0.00xxxx SOL
  mint A       exists (82 bytes)
  mint B       exists (82 bytes)
  phase        live
  pools        A 0.000000 SOL   B 0.000000 SOL
  traded       NO - ...
```

**The two mint lines are the ones that matter.** They are the half-launch check.
A battle account with no mints reads as a perfectly ordinary live battle from the
account alone, which is why 39 of them went unnoticed on chain.

**On `NOT ON CHAIN`:** `initializeBattle` did not land. Nothing was created and
nothing was spent beyond a possible failed-transaction fee. Start again at step 4.

**On `HALF-LAUNCHED`:** should be impossible from this page. If it happens, that
is a finding worth stopping for - it means the two instructions were not in one
transaction after all.

## Step 6 - trade

```bash
open http://localhost:3520/battle/<battleId>
```

**No buy is accepted until 60 seconds after the start time.** 59 seconds returns
`BattleNotActive` (error 6003); 60 is accepted. That is the on-chain program's
own check, not ours, measured against the chain clock on 2026-09-24, and it is
why the fastest first trade ever observed is 66 seconds. We hold no copy of the
program's source; the gate was established by submitting buys either side of the
boundary and reading what came back. The widget
shows a countdown. With "Starts in 2" you can buy from about three minutes after
launching.

Buy a small amount on **both** sides.

- Both sides makes the battle **traded**, which is the single property that
  predicts their indexer picking it up: 0 missing of 1,355 traded 2026 battles,
  against 37 of 77 untraded ones.
- Both sides gives a real winner. The program settles a tie to **artist B**.

**The price you get is not the price you see if you wait.** A buy is priced off
the pool the stored supply implies, and the curve steepens as supply grows. The
first widget trade on 2026-09-21 lost about 40% because it bought late into a
grown pool. That is the curve behaving correctly, reported as a measurement.

## Step 7 - end it

Trading closes at start plus the duration. After that:

```bash
npx tsx scripts/ww-settle-dry-run.ts
```

It packs every unsettled battle into transactions and simulates each one, without
a wallet and without signing. **Success:** your battle appears and its batch reads
`would succeed`.

Ending it for real from the UI needs `WW_OPERATOR=1` and another restart, same
shape as steps 1 and 2. Worth doing **before** the clock runs out rather than
after, so you are not restarting a server while a battle waits.

## Step 8 - the actual experiment

```bash
npx tsx scripts/ww-watch-ours.ts <battleId> --follow
```

Leave it. It re-checks every 60 seconds.

**This is the one question no measurement could answer.** Every traded 2026
battle is in their listing, 1,355 of 1,355 - but every one of those was launched
through **their** front end. The sample contains no battle originated anywhere
else, so history narrows the question and cannot close it. Ours is the first.

Their stats cache is 60 seconds; the indexer itself took about five minutes on a
battle observed live on 2026-09-25. **Give it an hour before concluding
anything**, and note that the `total` in their stats is a count, not a lookup - it
tells you their number moved, not that yours is the one that moved it.

## What is deliberately not in here

- How much to buy. Not addressed anywhere in this repo.
- Whether to launch during a live session. A test battle sitting next to real
  ones is a judgement call about the room, not a technical one.
- The keyed RPC. `SOLANA_RPC_URL` is unset and the public endpoint answered 165
  of 165 requests at 1.4/s for two minutes on 2026-09-21. Fine for one launch.

## Also see

- `scripts/ww-watch-ours.ts` - the verification, and the measurements behind it
- `lib/ww/launchPlan.ts` - the cost quote and why a partial one throws
- `lib/ww/quote.ts` - the curve, and why the pool is not an input
- `docs/PUBLIC-API.md` - every flagged route and what it gates
