# wwtracker audit and roadmap

Audited 2026-09-05, and revised the same evening after a working session that
moved several of these. Every figure here was measured by running the command
shown next to it, not recalled. Re-run them before trusting them - the point of
dating a claim is so you know when to be suspicious of it.

What moved on 2026-09-05, so the diff against an older copy reads clearly: the
cron gate was replaced rather than configured (4.1), the treasury refresh is now
rate-limited instead of secret-gated, nine stale pull requests were closed
against evidence and three reopened as fresh work, and the two dormant checks -
strict staleness and the upstream contract smoke test - were armed in CI.

This is the document to read first if you are picking the repo up cold. It says
what is solid, what is weak, and what to do next in priority order.

---

## 1. The working model

**wwtracker is the lab. wavewarz.info is production.**

Experiments, research and documentation live here. Finished, proven work moves
across to `CandyToyBox/wavewarz-intelligence`, which is fully in production and
is the system of record for WaveWarZ - it indexes Solana via Helius into
Supabase, runs the admin panel where Main Event judging is entered, and owns the
canonical Battle ID. Push access to that repo was granted 2026-09-05.

The practical rule: build and iterate here, port finished pieces there. Do not
open speculative PRs against the production repo.

**Division of coverage.** wwtracker covers the on-chain business layer - the
treasury wallet, the 3.5 SOL operating floor, the fee model, the business
ledger, and the Solana program decoded instruction by instruction. Anything
battle-shaped, artist-shaped or song-shaped is read live from wavewarz.info's
public API or linked out. It is never copied.

That rule exists because it was broken and the damage was measurable. Baked
copies drifted: a trader table showed the top trader at **-19.02 SOL** while the
platform's own API had the same wallet at **+29.95**, and a baked song list held
**37** rows against the API's **934**.

---

## 2. Health at a glance

Re-measured 2026-09-08 by running each command, not by editing the previous row.

Run them all with `npm run check`. It writes the complete output of every gate to
`var/check/<timestamp>/` whatever happens, because on 2026-09-08 a real test
failure on main was piped through `grep` for a one-line summary and the reason
was lost - five clean runs afterwards could not reproduce it and the test's name
was never seen. That is the same defect as a measurement whose last pipeline
stage swallows the exit code, and knowing the rule did not prevent it.

| Check | Command | Result 2026-09-08 | Was 2026-09-05 |
|---|---|---|---|
| Types | `npx tsc --noEmit` | clean | clean |
| Tests | `npx vitest run` | **435 passing, 46 files** | 288, 33 |
| Data validation | `node scripts/validate.mjs` | passing, 3 staleness warnings | same |
| Production build | `npm run build` | compiles | compiles, 60 pages |
| Dependency audit | `npm audit --omit=dev` | **3 high** | 3 high |

Size: 22 components / 5,963 lines, 40 lib modules, 13 API routes, 35 test files.
One TODO comment in the entire tree.

The lib count nearly doubled and the API route count more than doubled because
the routes were always there - the previous figure counted only `app/api/ww/*`
rather than all of `app/api`. That is a measurement changing, not the codebase.

---

## 3. Findings, worst first

### 3.1 Next.js carries 8 high-severity advisories - HIGH

`npm audit` reports 3 high vulnerabilities, of which the substantial one is
Next.js 14.2.35. Advisories include DoS via the Image Optimizer, HTTP request
smuggling in rewrites, cache-poisoning of middleware redirects, and XSS in App
Router apps using CSP.

The fix is `next@16.3.4` - a **two-major-version** jump from 14. That is not a
patch, it is a migration, and it should be planned rather than run as
`npm audit fix --force` on a Friday.

Mitigating context, which is why this is high and not critical: we do not use
`next/image` with remote patterns, we have no rewrites and no middleware, and
the app is deployed on Vercel rather than self-hosted, which neutralises several
of the self-hosting-specific advisories. It still wants doing.

    npm audit --json | python3 -c "import json,sys; [print(k, v['severity']) for k,v in json.load(sys.stdin)['vulnerabilities'].items()]"

### 3.2 Component test coverage is thin - HIGH, and got worse

**Re-measured 2026-09-08 and the finding has strengthened against its own
author.** Still **two** components have any test - `BalanceDashboard` and
`FreshnessBanner` - while the component count went 20 -> 22 and the test count
went 288 -> 435. So the ratio moved from 2/20 to **2/22** across a day that added
147 tests.

The 2026-09-05 version of this section predicted exactly that: *"the new tests
went where tests were already easy to write."* It then happened again, on the day
it was written, to the person who wrote it. Every one of the eight test files
added on 2026-09-07 and 2026-09-08 lives in `lib/__tests__`.

In fairness to the day, several of those tests are the *class* this section asks
for even though they are not in `components/` - `feeRates.test.ts` and
`measured.test.ts` assert published figures against their source, which is the
stated point. But `liveWatch`, `battlePhase`, `holderList` and `redact` are all
pure functions extracted **out** of components precisely so they could be tested,
and extraction is not the same as covering what is left behind.

That is the wrong shape for this repo, because the bugs that actually shipped
this year were in components, not in lib: a panel labelled `LIVE - DAILY
ACTIVITY, LAST 30 DAYS` reading an 81-day-old file, prose reading "net negative"
above a positive number, a chart scaled so four of its five bars were
indistinguishable. None of those are type errors and none would have been caught
by the existing suite.

The highest-value tests are not render tests. They are assertions that a
component's displayed figure equals the figure in its source, and that a label
claiming freshness is backed by a date check.

### 3.3 Everything is a client component - MEDIUM

All 20 components carry `"use client"`. Several have no interactivity at all and
exist only to render numbers from a snapshot - those could be server components,
which would cut the JavaScript shipped to the browser.

The page is currently **30,773px** tall with 61.6 kB of route-specific JS and
261 kB first-load. Not alarming, but the ratio of static content to client
JavaScript is poor.

    # measure: load the page and read document.body.scrollHeight

### 3.4 Three data files are stale and unreferenced - MEDIUM

`public/ww-skips.json`, `public/ww-queue.json` and `public/ww-wavysplit.json`
are 81 days old and no section renders them. They are deliberately kept, not deleted: PR #212
extended the DJ Wavy split to 103 nights on 2026-08-26, so they are actively
maintained data. They are a widget waiting to be built, not dead weight.

The skip-queue auction they describe is real treasury revenue - 0.02 SOL to jump
the queue, escalating 0.01 per jump - and the mechanic is already modelled in
`lib/feeModel.ts`. See 4.2.

As of 2026-09-05 they are parked explicitly rather than tacitly: `KNOWN_STALE`
in `scripts/validate.mjs` exempts all three from the strict staleness gate
**until 2026-10-15**, after which strict fails on them whatever their age. The
exemption has a deadline so that continuing to park them is a decision someone
makes again, not one inherited by silence.

### 3.5 The pre-April-2026 volume history is inherited, not verified - MEDIUM

`public/ww-platform-volume.json` is built from wavewarz.info's per-battle
volumes. Their own README states that **battles settled before 2026-04-27 had
corrupted volume data**, fixed by a backfill script in **their** repo (not this one), because
`artistAPool` is the net vault balance and goes to zero at settlement rather
than recording gross flow.

Our series therefore inherits whatever that backfill left behind. The total
agrees with their reported figure to within 0.2 SOL (921.4852 against 921.29),
so it is consistent with them - but consistency with a source is not the same as
correctness, and the Growth section presents 2025 volume with the same
confidence as last week's. It needs a footnote at minimum.

### 3.55 The top-traders embed was republishing a figure we measured as wrong - WITHDRAWN 2026-09-07, RESTORED 2026-09-08

The `top-traders` widget rendered a **Net P&L** column straight from
`wavewarz.info/api/public/leaderboards/traders`, proxied through
`/api/ww/leaderboards/[kind]`. On 2026-09-07 that leaderboard was measured
against a complete scan of every trade in the platform's history - 1,643
battles, 15,359 trades, read from Solana:

    the site   145 wallets summing to +204.29 SOL of trader profit
    chain      157 wallets summing to  -17.08 SOL

Traders in aggregate must be down by roughly the fees taken out of them. The
platform's arithmetic is correct; its `trades` table is short, because hydration
fetches a battle's whole history and skips the write on failure, so the biggest
battles are lost first. Full derivation in the protocol repo,
`recon/PNL-DIAGNOSIS.md`.

**Why this belonged in section 3 and not in someone else's backlog.** Section 1
says wwtracker never copies a battle-shaped figure, after a baked trader table
drifted to -19.02 against the platform's +29.95. That rule was followed here -
the widget proxies live rather than baking - and it was not enough, because
proxying a wrong number publishes it just as effectively. The rule needed the
second half it now has: **we do not re-publish a figure we have measured to be
wrong, live or baked.**

It was also the worst possible surface for it. An embed sits on somebody else's
page under our attribution line, and a caveat in this file does not travel with
a screenshot.

**Restored 2026-09-08.** The record layer backfilled and we audited it rather
than took it on trust. Re-measured against the same chain scan:

| | Withdrawn 2026-09-07 | Restored 2026-09-08 |
|---|---|---|
| Site aggregate | +204.29 SOL | **-21.46 SOL** |
| Wallets | 145 | **157** |
| Shown in profit while down | 45 | **0** |
| Largest single delta | 213.38 SOL | **0.70 SOL** |

The remaining 4.38 SOL gap is not error - it is winnings earned on chain and
never claimed. Our figure models settlement as **earned**, theirs counts it as
**claimed**, and several wallets match to the lamport once unclaimed is
subtracted. Theirs is the right definition for a page that says P&L: somebody who
has not claimed has not been paid. The audit is in the protocol repo at
`recon/AUDIT-CANDY-PNL-2026-09-08.md`.

The rule that produced both decisions is the same one. We do not re-publish a
figure we have measured to be wrong, **and we do not keep a column withdrawn once
it is measured right.** Both directions need the measurement, and a test now
binds the flag to it - flipping it back without re-measuring fails the build.

The column is back, with the measurement, the reason and the one command
that re-checks it in `lib/traderLeaderboard.ts`. `EmbedShell` grew a `note`
prop so the caveat renders inside the frame. Volume and win rate stay, and the
note says plainly that they come from the same short rows.

The concentration is the part worth remembering: one wallet is displayed at
+159.01 SOL while being -54.37 on chain, and that single row is 213 of the 221
SOL gap. It belongs to a Grand Final competitor, and the final is 13 September.

### 3.8 The Dune fallback figures diverge from chain, and nobody has said which is right - MEDIUM

`lib/wwData.ts` carries a baked `ProgramSummary`. It is the **fallback** rendered
in `OnChainProof` when the WaveWarZ API is unreachable, so it is what a visitor
sees on a bad day - labelled `(snapshot)`, which is honest about its age and
silent about its method.

Compared against the complete chain scan on 2026-09-08:

| | Dune, baked | Chain scan | |
|---|---|---|---|
| `battlesCreated` | 1,643 | **1,643** | exact |
| `battlesSettled` | 1,602 | 1,550 decided / 1,506 with a distribution | neither matches |
| `buys` | 9,646 | 9,297 | Dune +349 |
| `sells` | 3,409 | 2,671 | Dune +738 |
| `claims` | 2,762 | 3,390 | Dune **-628** |
| `uniqueTraders` | 165 | 157 | Dune +8 |

**The shape is the finding.** They agree *exactly* on the population - 1,643
battle accounts - and disagree on the events inside it, in both directions: Dune
counts more buys and sells, and fewer claims. Agreement on the population with
disagreement on its contents points at instruction classification rather than at
coverage. One of them is counting something the other is not, on both sides.

**Two explanations have been tested and both are dead.**

A "unique traders" count including wallets that only ever claimed would explain
165 against 157 - but **zero** wallets claimed without also having traded.

The Dune date floor is the better candidate and it fails harder. Three queries
filtered from 2025-08-01, excluding 75 battles and roughly 4% of every event
type. But excluding that window makes the gap **wider**, not narrower:

| From 2025-08-01 only | Dune | Chain |
|---|---|---|
| buys | 9,646 | 8,929 |
| sells | 3,409 | 2,543 |
| claims | 2,762 | 3,242 |

So Dune counts more trades than chain holds *even on the narrower window*, and
still fewer claims. A coverage gap cannot produce that; only a different
definition of what a buy, a sell and a claim are can.

**The decoder is not the problem, and that is now measured.** The same
Dune-derived dataset carries `created`, `minted` and `settled` per day.
Summed and checked against the chain census:

| | Dune-decoded | Chain census | |
|---|---|---|---|
| `created` | 1,643 | 1,643 | exact |
| `minted` | 1,604 | 1,604 | exact |
| `created - minted` | **39** | **39** | exact - the documented abandoned creations |

Three independent exact matches at full population, including reproducing the 39
no-mint creations that took a separate investigation to find on our side. Whoever
wrote that decoder got `initialize_battle` and `initialize_mints` right across
1,643 accounts.

So this is not accuracy. It is definition, and the sign tells you it is more than
one definition: Dune counts **more** buys and sells than chain holds and **fewer**
claims. A single systematic cause - a dropped instruction, a missed program, a
window - moves everything the same way. This does not.

### SOLVED 2026-09-08: `sells` and `claims` are transposed in the source

Diffing **day by day** rather than in aggregate - the row-level check this
section kept recommending - answers it immediately. Across the 330 days both
cover:

| Reading | Days it holds |
|---|---|
| `dune.sells == chain.claims` **and** `dune.claims == chain.sells` | **259 (78%)** |
| `dune.sells == chain.sells` - the straight reading | 22 (7%) |
| `sells + claims` **total** agrees | **259** |

<!-- measured 2026-09-08T19:20Z · zao-measure --verify "wwtracker: dune sells/claims transposed" -->

Re-runnable by anyone who doubts it, including a future session:
`zao-measure --verify "wwtracker: dune sells/claims transposed"` re-runs the
command and reports HOLDS, DRIFTED with both values, or UNVERIFIABLE. The command
behind it is `tools/dune-daydiff.py` in the protocol repo, run under
`offline-run.py` with networking denied.

Thirty-five to one, and the pair total agreeing on exactly the days the swap
holds is what makes it a relabel rather than missing data: the decoder sees every
instruction and files two of them under each other's name.

That explains the aggregate signature this section could not - Dune counting
*more* sells and *fewer* claims, in opposite directions, with the battle counts
exact. It was never a coverage question.

**It shipped.** `AboutWaveWarZ` rendered `CLAIMS 2,762 / winnings withdrawn` when
2,762 is the sell count and claims are 3,388, and `BattleLifecycle`'s
`buysPerSell` was built on it.

Corrected in `scripts/ww-gen.mjs` at the boundary so a regeneration cannot
reintroduce it, with tests pinning the swap - the obvious "fix" for somebody who
has not read this is to straighten the mapping and put the bug back. The real
repair belongs upstream, in whatever produces `public/ww-onchain-daily.json`,
which is not in this repo.

**The buys residual, and my first explanation for it was wrong.**

I recorded it as looking like a day-boundary or timezone effect. Tested, and it
is not:

    days with a buy mismatch          138 of 330
    sum of all deltas                 +349
    sum of |deltas|                    349   <- identical, so NO negative delta exists
    adjacent day-pairs, opposite sign  0 of 68 (0%)

A boundary shift moves events between neighbouring days, so it produces roughly
balanced positives and negatives. **There is not a single day where Dune counts
fewer buys than chain.** It is strictly one-directional, on 138 days, mostly by
+1 or +2.

So Dune sees buy instructions the chain scan does not. The likeliest remaining
explanation - and it is a hypothesis, not a measurement - is that
`solana.instruction_calls` includes instructions from **failed or reverted
transactions**, which our scan excludes because it only records trades with
parsed amounts. The 39 no-mint battles would generate exactly this shape:
attempted buys that could never succeed.

**MEASURED 2026-09-10 - it is failed transactions, and it was measurable from our
side.** The paragraph that stood here said it was not, because the snapshot only
holds successful trades. But `getSignaturesForAddress` on each battle vault
returns failed signatures with `err` set, and the public RPC serves them - no Dune
credit, no key.

    16 days tested - 4 chosen, 12 drawn at random (seed 20260910), 5 of them
    days where Dune and chain AGREE on buys, as controls

    failed buy instructions on the vaults   == Dune buy excess          16 of 16
    failed sell + claim instructions        == Dune sells+claims excess 16 of 16
    control days                            0 failed buys, 0 excess

Exact on every day, both legs, including the controls. So the Dune series is
**chain plus failed attempts, with sells and claims swapped.** Lifetime that is
349 failed buys, 91 failed sells and 21 failed claims - **440 failed attempts
rendered as trades**: "12,408 trades" on the site against 11,968 that happened.

The 4% tolerance in the tests that pinned these figures is what let it ship. The
error was 3.7%.

**Fixed at the read, 2026-09-10.** Buys, sells and claims now render from the
chain scan per day (`public/ww-chain-daily.json`, from wavewarz-protocol
`tools/chain-daily.py`, offline). Dune is kept for the columns the scan does not
cover, and checked against the scan: the tests assert Dune is never below chain
on a complete day, which is the relationship this finding rests on. The swap
itself moved from an inline copy in `ww-gen.mjs` into `lib/onchainCorrect.mjs`,
shared by the build and the browser read.

Still open: `txs` almost certainly counts failed transactions too, by an
UNMEASURED amount - the failed scan counts instructions, not transactions. And the
guess that the 39 never-minted battles produce the failed buys is untested.

Recorded this way on purpose: a refuted explanation left standing is worse than
none, because the next reader stops looking.

**The lesson is the method.** Three attempts failed at the aggregate level; the
day-level diff took one run. Aggregates hide transpositions perfectly, because
every total is conserved.

**Do not reconcile this by editing either number.** Today produced two separate
cases where a figure that looked wrong was a different definition doing its job -
458 SOL against our 410.97 at the same date, and the record layer's `trades`
table against chain. The disagreement here is worth resolving by asking what the
Dune query counts, not by picking the number that feels better.

Until it is resolved, the honest reading is that `battlesCreated` is
corroborated by two independent methods and everything else in that struct is
single-sourced.

### 3.9 Showing your working can make a wrong number more persuasive - the hazard in our own convention

Convention 20 says a published figure names its legs and its measurement date.
That convention caught real errors today. It also produced one.

`lib/measured.ts` carried `SOL_USD = 180` while `lib/price.ts` said 101.9, both
stamped 2026-09-05. The 180 was never measured - it was typed, in the file whose
entire purpose is that figures are measured and single-sourced - and it shipped
onto the live case-study page as:

    ~$167K at $180/SOL

The honest figure is ~$96K. A 74% overstatement inside a block called
`CITABLE_FACTS`.

**The annotation made it worse, not better.** `~$167K at $180/SOL` reads more
trustworthy than a bare `~$167K`, precisely because it shows its working. A
reader who checks can catch it; a reader who does not is now more confident in a
wrong number than they would have been without the basis attached.

So the convention is **necessary and not sufficient**. Naming a basis you did not
measure manufactures credibility. The sufficient half is mechanical:
`lib/__tests__/solPrice.test.ts` asserts exactly one `export const SOL_USD`
exists in the repo and that it sits in a plausible band - because the duplication
was the root cause rather than the digits, and because 180 passed every test here
for a day.

That framing is the finance lane's, sharpened against my own softer version,
which had let the convention off.

### 3.6 `lib/leaderboard.ts` is a snapshot pretending to be a roster - LOW

A 2026-06-15 snapshot of 48 artists, against 52 live. It is no longer used for
displayed statistics - the artist page reads those live - but it still drives
`generateStaticParams` for `/artist/[handle]` and the recap tooling. So the set
of artist pages that exist is frozen at June.

### 3.7 Minor - LOW

- 3 `<button>` elements without an explicit `type`, which default to `submit`.
- `npm outdated` shows React types at 18.x against 19.x available; deliberate,
  since React 19 pairs with the Next 16 migration in 3.1.
- The roster payload is 193,025 bytes. Down from 276,067, but still the largest
  single response the app serves.

---

## 4. Roadmap, in the order worth doing

### 4.1 The cron gate - DONE 2026-09-05, superseded

This was "set `CRON_SECRET` in the Vercel project env - 2 minutes, blocking".
Without it the daily cron got a 401 on `/api/balance?refresh=1` and the treasury
chart silently froze, as it did for **64 days**, 2026-07-03 to 2026-09-05, while
the README described the chart as live.

Rather than set the env var, the gate was replaced. `lib/refresh-policy.ts`
bounds the refresh by the age of Dune's own stored execution (20h) instead of by
a bearer token, so the endpoint is still safe from anonymous credit-burn but no
missing environment variable can freeze the chart again. `CRON_SECRET` survives
as an optional force override for manual re-runs.

The reasoning is worth keeping: the old gate failed **closed** and silently, and
a missing env var was indistinguishable from an attack. The new one fails open
on an unknown state and reports which branch it took in the response body. 13
tests in `lib/__tests__/refresh-policy.test.ts`, one of which asserts the
64-day-old execution would now trigger a re-run.

### 4.2 Build the skip-queue revenue widget - half a day, soft deadline 2026-10-15

The data exists (3.4), the mechanic is modelled and tested in `lib/feeModel.ts`,
and it is genuinely unpublished information about platform revenue. It fits
section 04 and becomes embed widget 16.

Blocked on nothing except regenerating the three files from Dune. Note the open
question in `docs/issues/001-fnj-payment-bucket-classification.md`: the
skip-versus-queue calibration is verified against exactly one night and may be
misattributing other payments to the platform. Close that first or state the
uncertainty on the widget.

### 4.3 Ask WaveWarZ for four API endpoints - one message

Their API docs explicitly invite requests. Missing today:

- Community rankings (a full populated page, no endpoint)
- Clipper rankings (same)
- Benefits charity totals (page-only aggregate)
- The homepage "Heat" score (UI-computed, no field anywhere)

Three more embeddable widgets fall out the moment these exist. Now that we have
push access to their repo, this could be a PR rather than a request.

### 4.4 Add component tests where numbers are displayed - one day

Target the class of bug that actually shipped (3.2). For each section that
renders a figure, assert the figure matches its source, and assert that any
label containing the word "live" is backed by a real freshness check. Start with
`OnChainProof`, `PlatformAnalytics` and `BattleLifecycle`, which carry the most
numbers.

### 4.5 Plan the Next 16 migration - one to two days

Addresses 3.1 and 3.7 together. Two majors, so read the codemods and upgrade
guides rather than forcing the audit fix. Worth pairing with converting
non-interactive components to server components (3.3), since that work touches
the same files.

### 4.6 Add a battle cohort view - half a day

The lifecycle funnel in section 08 shows all-time gaps. It does not show whether
they are getting better or worse. `BattleLifecycle` already has a monthly trend,
but a true cohort - following each battle_id from creation to its own settlement
and claim - needs per-battle rows rather than the daily aggregate the repo has
today. That is a new Dune query, not a UI change.

---

## 5. What is genuinely solid

Worth stating, so a reviewer does not assume everything needs work.

- **Provenance.** Every number on the site traces to a named source, and where a
  figure is a model rather than a measurement (the settlement waterfall, the
  skip ladder) the component says so.
- **Failure contracts.** The `/api/ww/*` routes return 200 with a `status` field
  rather than a 5xx, because a 5xx pushes consumers into error paths where they
  render a zero. "Unknown" is rendered as unknown, never as 0.
- **The staleness gate.** `scripts/validate.mjs` warns at 14 days and fails at
  45 under `--strict`. It caught seven stale datasets the first time it ran.
- **The embed system.** 15 widgets, registry and component map verified in
  agreement, CSP-restricted framing, and every widget carries a source line
  linking back. Seven of the fifteen have no equivalent anywhere in the
  ecosystem.
- **Third-party citizenship.** Audius went from 208 browser requests per visitor
  with 86 rate-limited, to zero, by moving the walk server-side behind a
  30-minute cache. YouTube embeds use `youtube-nocookie.com` so the page does
  not drag ad trackers onto any host that embeds it.

---

## 6. Traps that have already cost time

Recorded so nobody pays for them twice.

- **`vercel.json` `ignoreCommand` is capped at 256 characters.** Over that,
  Vercel rejects the entire file during schema validation, before any build
  starts - so the deployment errors instantly with no build log, which looks
  exactly like an environment problem. A 302-character command cost a production
  deploy on 2026-09-05. `scripts/validate.mjs` now asserts the cap.
- **An empty `VERCEL_GIT_PREVIOUS_SHA` makes `git diff --quiet` exit 0**, which
  skips the build, which means the branch still has no deployment, which means
  the next push is skipped for the same reason. A branch sat in that loop through
  three pushes reporting "Ignored" with nothing built.
- **Reading Dune's cached results is not the same as Dune re-running the query.**
  `/api/balance` re-read a stale execution faithfully for 64 days.
- **Every documented Dune query filtered `block_date >= 2025-08-01`** against a
  program whose first instruction is 2025-05-26. Every all-time figure ran about
  45 percent low until 2026-09-05. **And that fix landed in the data, not in the
  generator.** `scripts/ww-research.sh` still carried the filter in three of its
  five queries until 2026-09-08, so the next person to regenerate would have
  silently reintroduced a hole somebody had already paid to find. The baked
  series was correct the whole time, which is exactly why nobody noticed. There
  is a test on the script now - fixing a number and fixing the thing that
  produces it are different jobs.
- **Solana PDA derivation hashes seeds, then the bump, then the program id.**
  Not seeds/program/bump. Get the order wrong and you still get a well-formed,
  off-curve, entirely valid-looking address - it is simply not the account, and
  `getAccountInfo` returns null with no error. It reads as "that battle does not
  exist." Cost: `scripts/ww-battle-decode.ts` shipped in a PR that could never
  have worked, and sat open for 50 days. Found 2026-09-05 by running it against
  chain rather than reading it.
- **`Bearer ${process.env.SECRET}` with the variable unset is the string
  `"Bearer undefined"`**, which any caller can send. A missing env var becomes an
  open door. Guard the comparison with a truthiness check on the secret itself;
  the check is load-bearing, not defensive noise. This shipped elsewhere in the
  estate the same week.
- **A gate nobody invokes is not a gate.** `validate.mjs --strict` fails on data
  past 45 days and was referenced in three documents as a live safeguard while
  `grep` found it invoked in exactly zero places. Three datasets sat 81 days old
  underneath it. Armed in CI 2026-09-05. The same was true of `smoke:stats`.
- **Dune's free tier times out at 2 minutes.** Anything joining
  `solana.account_activity` to `instruction_calls` across the whole history will
  not complete. Address-filtered queries are fine; per-signer joins are not.
