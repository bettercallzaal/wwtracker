# Branch audit, 2026-09-19

> **The METHOD lives here. The LEDGER of what was actually deleted is
> [archive/branch-cleanup-2026-09.md](archive/branch-cleanup-2026-09.md)** -
> three runs, 242 remote heads down to 3, every tip sha, and the commands that
> restore any of it. This file kept the reusable part; four dated files that
> each covered one run were folded into one, because four documents about one
> subject is how a reader gets three of them and misses the fourth.

What is on the 236 branches this repo has pushed since June, what of it never
reached `main`, and which of that is worth rescuing.

Run against `origin` after PR #306 merged. Read-only: nothing was deleted,
force-pushed, or rewritten.

## The shape of the trail

| | count |
|---|---|
| remote branches (excluding `main`) | 235 |
| with a MERGED pull request | 98 |
| with a CLOSED pull request | 135 |
| with no pull request at all | 2 |
| open pull requests at audit time | 0 |

`CLOSED` is not `abandoned` here. The July working style was many small branches
funnelled into one consolidated PR, so most closed branches were superseded
rather than rejected - `feat/speaker-log-parser` through `feat/speaker-log-cli`
are five closed PRs whose every file is **byte-identical to `main` today**.

## The measurement that does not work, and why it is worth writing down

The obvious test - does this branch differ from `main`? - answers **yes for 181
of 235 branches**, including every branch that merged cleanly in July. It cannot
distinguish "this branch holds work you lost" from "`main` has moved on since
July", and the second case is almost all of them. A cleanup driven by that
number would have put 181 branches in front of a person.

**The test that works: which paths did the branch ADD that `main` has never
carried.** Not "differs from", not "is not an ancestor of" - squash merges make
ancestry meaningless here, as an earlier audit on this repo learned when
`--is-ancestor` reported 32 unmerged branches and the real number was 3.

    base=$(git merge-base main "$ref")
    git diff --name-status --diff-filter=A "$base".."$ref" \
      | while read st f; do git cat-file -e "main:$f" || echo "$f"; done

That narrows 235 branches to **74**, and 65 distinct paths.

**It flags candidates, not losses.** A file renamed on `main` shows up as an
orphan: `docs/CLONE-AUDIT.md` appears in this list and is alive on `main` as
`docs/archive/2026-08-25-duplicate-clone-check.md`. Check each before acting.

## What is actually only on a branch

**45 React components**, all from the July `feat/wave*` series, peaking at
`feat/wave30-appshell-full-stack` (10 commits, 45 new components, never merged):

    ArtistEarnings ArtistProfile ArtistStandings ArtistVolume BattleArena
    BattleCalendar BattleTempo BattleTypeBreakdown BattleTypeEvolution
    BiggestBattles CommunityBattles CumulativeGrowth DistributableNow DowActivity
    EconomicsBreakdown FractalGovernance GrowthMomentum HandleH2H HotStreaks
    IPHighlights LiveBattleBanner LiveBattleTypes LivePlatformStats LiveTicker
    MarginDistribution MilestonesTimeline MonthlyVolume NailBiters PlatformPulse
    PlatformSummary RecentBattlesFeed RecentStandings RevenueCurve RevenueFloor
    RivalryBoard SongArena SongRecords SongRematches TopRivalries TraderActivity
    WinRateLeaderboard WwMedia WwNow ZaoIPSummary ZaoVitals

`main` carries 28 components. These 45 are not stale hardcoded snapshots - they
read `public/ww-battles.json` and `wavewarz.info/api/public/stats` live, and
they compiled.

**THEY RAN OUT OF DEPLOYMENTS.**

**The population, stated as a command, because an unreproducible count is an
assertion.** Every remote branch that added at least one `components/*.tsx` that
`main` has never carried:

```
for ref in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin \
             | grep -v -E '^origin(/(main|HEAD))?$'); do
  b=${ref#origin/}; base=$(git merge-base main "$ref") || continue
  git diff --name-status --diff-filter=A "$base".."$ref" \
    | while read st f; do case "$f" in components/*.tsx)
        git cat-file -e "main:$f" 2>/dev/null || { echo "$b"; break; };; esac; done
done | sort -u
```

**53 branches**, each with exactly one pull request, **all 53 closed, none
merged**. Note what this is NOT: branches whose name starts `feat/wave` are only
15 of the 53, so selecting on the name gives a different and much smaller set.

Counting the failure comment over those 53:

```
gh pr view <n> --json comments --template '{{range .comments}}{{.body}}{{end}}' \
  | grep -q 'api-deployments-free-per-day'
```

**51 of the 53** match:

    Deployment failed with the following error:
    Resource is limited - try again in 24 hours
    (more than 100, code: "api-deployments-free-per-day")

That is Vercel's free tier refusing to build a preview after 100 deployments in
a day. The closures cluster on two days - **34 on 2026-07-29, 18 on 2026-07-17**,
with a single straggler on 2026-09-05 - which is the shape of a batch being
cleared out, not 53 separate judgements.

**So no preview was ever built for most of them.** Whether anyone ran them
locally is not something a pull request records, and this section previously
claimed nobody ever saw them render, which the comments do not establish. What
the comments establish is that the hosted preview never built, and that a wave
of small pull requests was opened faster than a free tier would serve them.

**THREE VERSIONS OF THIS PARAGRAPH, WRONG TWICE, AND THE COUNTS WRONG A THIRD
TIME.** The first asserted the components were dropped because they duplicate
wavewarz.info - inference, never recorded, believed because it matched the
repo's standing thesis. The second said the reason was unrecorded - declared
after searching `docs/` and commit messages only, while the answer sat in the
pull request comments. The third gave the right cause with counts nobody could
reproduce, drawn from a looser population than the sentence described; a review
measured `feat/wave*` instead, got different numbers, and was right to hold it.
**Hence the commands above.**

What is still genuinely unknown is whether anyone later decided against the work
on its merits. The overlap with wavewarz.info is real, and this repo's thesis is
the business layer. **But no one wrote that down, and the only recorded cause is
a deployment cap.**

**Do not rebuild them without asking first.** That instruction survived all three
versions of this paragraph, and it is the only part that had to be certain.

**Four weekly recaps** - `recaps/weekly/2026-07-{17,23,24,28}-weekly.md` - exist
only on `recap/weekly-*` and `chore/battles-refresh-*` branches. `main` carries
`recaps/STATE.json` and one space recap. Low value now; the figures in them are
July snapshots of a feed that has since been shown to carry a volume bug.

**Six community-research documents** from July 16-17, all re-verification passes
over the same 2026-07-15 leads after a WebFetch outage cleared. `main` carries
`2026-07-17-community-closure.md`, which is the closing entry of that same
sequence. Redundant; left where they are.

**One research document worth rescuing**, and it has been:
`docs/research/wavewarz/2026-07-16-judging-system-v1-v2.md`. It is the only
description anywhere in this estate of the March 10, 2026 judging change, and
`main` had nothing on judging at all. Rescued in this branch **with its headline
finding re-checked and contradicted** - see the note at the top of that file.

**Two branches have no pull request:** `rescue/1e49540-soltracker-main`, which
carries `RESUME.md` and `docs/AUDIT-2026-08-25.md` from the stale
`~/Documents/soltracker` clone and is superseded by
`docs/archive/2026-08-25-duplicate-clone-check.md`; and `ws/readme-current`,
which is Zaal's to decide - its idea (date the frozen figures in the README) is
still right, its numbers are superseded, and it conflicts.

## What was deliberately not done

**No branch was deleted, on `origin` or locally.** 235 remote branches is untidy
and costs nothing; deleting them is a one-way action on somebody else's history
view, and the only branches provably empty are the 55 whose every touched path
is already byte-identical to `main`. If Zaal wants them gone, that list is
reproducible from the method above in about a minute.

## Numbers a reader can check

Every count here comes from `git ls-remote`, `gh pr list --state all --limit
400`, and the merge-base test above, run 2026-09-19 against `origin`. The
branch and PR totals sum: 98 merged + 135 closed + 2 with no PR = 235.
