# wwtracker audit and roadmap

Audited 2026-09-05. Every figure here was measured on that date by running the
command shown next to it, not recalled. Re-run them before trusting them - the
point of dating a claim is so you know when to be suspicious of it.

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

| Check | Command | Result 2026-09-05 |
|---|---|---|
| Types | `npx tsc --noEmit` | clean |
| Tests | `npx vitest run` | 275 passing, 32 files |
| Data validation | `node scripts/validate.mjs` | passing, 3 staleness warnings |
| Production build | `npm run build` | compiles, 59 pages |
| Dependency audit | `npm audit --omit=dev` | **3 high** |

Size: 20 components / 5,756 lines, 24 lib modules / 2,343 lines, 6 API routes,
32 test files. One TODO comment in the entire tree.

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

### 3.2 Component test coverage is thin - HIGH

32 test files cover `lib/` well. Only **two of twenty** components have any
test: `BalanceDashboard` and `FreshnessBanner`.

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

### 4.1 Set `CRON_SECRET` in the Vercel project env - 2 minutes, blocking

Without it the daily cron gets a 401 on `/api/balance?refresh=1` and the
treasury chart silently freezes. It already did this for **64 days**, from
2026-07-03 to 2026-09-05, while the README described the chart as live.

This is the single highest value-per-minute item in the repo and it is not a
code change.

### 4.2 Build the skip-queue revenue widget - half a day

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
  45 percent low until 2026-09-05.
- **Dune's free tier times out at 2 minutes.** Anything joining
  `solana.account_activity` to `instruction_calls` across the whole history will
  not complete. Address-filtered queries are fine; per-signer joins are not.
