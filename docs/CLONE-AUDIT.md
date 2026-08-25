# Clone audit: Documents/soltracker vs Desktop/repos/wwtracker

Both folders are clones of `github.com/bettercallzaal/wwtracker`, both on `main`,
both rooted at the same first commit `ea07f31` (2026-06-14).

Audited 2026-08-25. Read-only: nothing was moved, deleted, pushed, or fetched.

| | A: `~/Documents/soltracker` | B: `~/Desktop/repos/wwtracker` |
|---|---|---|
| HEAD | `426d4ab` 2026-08-25 | `94d5169` 2026-08-16 |
| commits | 71 | 235 |
| tracked files | 57 | 161 |
| local branches | 1 | 204 refs |
| folder size | 2.8M | 652M |
| `.git` size | 2.0M | 6.3M |
| working source | ~800K | ~1.4M |

## The size gap is not a content gap

B's 652M is 300M `node_modules` + 344M `.next` build cache. Both are gitignored
and rebuildable. B's actual repository is 6.3M. The real difference between the
clones is **161 tracked files vs 57**, not the megabytes.

## History relationship: A is stale, not forked

    ea07f31 ... 3b07c1b (2026-06-16)  <- shared base, 70 commits
                   |
                   +-- 426d4ab                      A  (+1 commit)
                   |
                   +-- ... 165 commits ... 94d5169  B  (+165 commits)

- All 70 of A's pre-existing commits are ancestors of B's HEAD. B contains
  every line of work A ever had.
- A has exactly **one** commit B does not: `426d4ab`, made today.
- A has no stashes, no extra branches, no tags, and no unreachable commits.
  There is no hidden work.

A is not a divergent fork. It is a two-month-old checkout with one new commit
on top. Pushing `main` from A would still be rejected as non-fast-forward, but
the remedy is a one-commit cherry-pick, not a merge or a force-push.

## What A has that B does not

Per-file comparison of all 57 of A's tracked files against B's HEAD:
20 identical, 37 differ. Of the 37, **36 are files where B is ahead** and A is
still sitting on the `3b07c1b` version. Exactly one file goes the other way.

### 1. `public/ww-wavysplit.json` - the only content asset (commit `426d4ab`)

| | A | B |
|---|---|---|
| nights | 103 | 80 |
| last touched | 2026-08-25 | `8d07066`, 2026-06-16 |

A's file is a strict superset. All 80 of B's nights are present with byte-identical
values; 23 nights are new (2026-04-11..04-28, several January nights, and the two
launch-era nights 2025-05-29 / 2025-06-16). Zero conflicting values.

Compatibility with B is confirmed:
- B's consumer is `components/Battles.tsx:53`, typed
  `Record<string, { queue: number; wavy: number }>` - matches the file's shape.
- B's `scripts/validate.mjs:58-63` asserts `nights >= 30`; 103 passes.

This file is safe to move as-is.

### 2. Untracked / gitignored local state (not in git, so invisible to any push)

| Item | Status in B | Verdict |
|---|---|---|
| `.env.local` | **absent** - B has only `.env.example` | **must move.** Sole copy of the Dune credentials. Without it B cannot run any refresh script. |
| `.vercel/project.json`, `.vercel/README.txt` | absent | move if Vercel CLI deploys are used. Irrelevant if the project deploys via the GitHub integration - verify which. |
| `RESUME.md` | absent | port the parts not already in B's docs (see below), then retire. |
| `.claude/settings.json` | B has `settings.local.json` only | review and merge by hand, do not copy over. |
| `.gstack/browse-network.log` | absent | disposable log. |
| `.claude/scheduled_tasks.lock` | tracked in both, deleted in B's worktree | not an asset. B has an unstaged deletion pending. |

`.gitignore` in B already covers `.env.local`, `.env*.local`, `.vercel`,
`.gstack/` and `.serena/`, so moving these files into B cannot leak them.

### 3. Knowledge in `RESUME.md` not yet in B's docs

B's `docs/REFRESH.md` already documents the Dune 2-minute execution cap and the
datapoint accounting. It does **not** contain:

- Dune query **7740037** - the query created on the replacement account after the
  old key hit HTTP 402. B's docs still reference the older query IDs only.
- The **3-day windowing** requirement for the busy Feb-Apr 2026 months. B's docs
  describe the 2-minute cap but not the workaround.
- The **key-rotation warning**: key-handling state is tracked in the private
  tracker; regenerate at dune.com (Settings -> API).
- The **open correctness question**: are there payments to the platform wallet
  `FNj...` beyond skip / queue / DJ Wavy (submissions, boosts, tips, features)?
  B's `docs/REFRESH.md:147` states the bucket rule (`0.005` = queue, `0.015-1.0`
  = skips) as settled fact. If other paid actions exist, some "skip" counts are
  mislabeled in both clones.
- The ~49 nights (2026-02-17..2026-04-28) still unclassified for the split.

## What B has that A does not

165 commits of work, on a PR-merge workflow (`ws/*` branches, PRs up to #210),
against A's direct-to-main commits. New surface in B:

- **A test suite A has none of**: `vitest.config.mts`, 19 files in `lib/__tests__`,
  11 in `scripts/recap/__tests__`, plus `npm test`.
- **Recap pipeline**: `scripts/recap/` (10 modules), `scripts/ww-recap.ts`,
  `scripts/ww-speaker-log.ts`, `scripts/ww-battles-fetch.ts`, `recaps/` output,
  and the `fetch:battles` / `recap` / `speaker-log` npm scripts.
- **New lib modules**: `config.ts`, `csv.ts`, `distributions.ts`, `dune-normalize.ts`,
  `opsLedger.ts`, `treasuryAnalytics.ts`, `wavewarzApi.ts`, `wwCache.ts`,
  `wwPublicRoute.ts`.
- **New routes**: `app/tournament/`, 3 new `app/api/` endpoints.
- **New docs**: `docs/research/` (15 files), `docs/superpowers/` plans and specs,
  `PUBLIC-API.md`, `STATS-ENDPOINTS.md`, `SURFACES.md`, `ECOSYSTEM.md`, `TEAM.md`.
- **New public assets**: `llms.txt`, `robots.txt`, `overlay.html`,
  `ww-lifetime.json`, `ww-daily-treasury.csv`.
- 8 updated components and newer versions of every shared doc, lib and script.

## Recommendation

**B (`~/Desktop/repos/wwtracker`) survives. A is a stale checkout carrying one
data commit and one irreplaceable secrets file.**

There is no case for keeping A. It has no code, docs, tooling or tests that B
lacks, and B is ahead on 36 of the 37 files that differ.

### What has to move, in order

1. **`.env.local` -> B.** Do this first and confirm B can run a refresh. This is
   the only file in A that cannot be reconstructed from git. Copy it; do not move
   it until step 5.
2. **The wavysplit commit -> B.** From B: `git cherry-pick 426d4ab`, sourcing the
   object from A (or simply copy `public/ww-wavysplit.json` across and commit it
   there). Then `npm run validate` to confirm the 103-night count passes the gate.
   Per B's PR-merge convention this belongs on a `ws/` branch and a PR, not
   direct to `main`.
3. **`.vercel/` -> B**, only after confirming deploys actually go through the
   Vercel CLI rather than the GitHub integration.
4. **Port the five `RESUME.md` items into `docs/REFRESH.md` in B** - query 7740037,
   3-day windowing, the rotation warning, the payment-bucket open question, and
   the unclassified-nights gap. The open question is a correctness risk that
   currently exists in both clones and is documented in neither.
5. **Rotate the Dune key** at dune.com, update B's `.env.local`, and only then
   retire A.

### Do not

- Do not push `main` from A. It would be a non-fast-forward against 165 commits.
- Do not delete A until steps 1-5 are done and B has been deployed and verified
  showing the 103-night split at `wwtracker.vercel.app/?tab=battles`.
- Do not copy A's `.claude/settings.json` over B's `settings.local.json` wholesale.
