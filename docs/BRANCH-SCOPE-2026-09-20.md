# "Update all to main": what that actually means, 2026-09-20

Zaal asked for every stale branch to be brought up to main. **Scoped first, as
the ruling required, and the scope is much smaller than 192 branches.**

Read-only. No branch was rebased, force-pushed, merged or deleted to produce
this.

## The headline

**191 branches carry at least one commit `main` does not have. All 191 merge
`main` cleanly - zero conflicts.** But most of them need nothing doing, and the
ones that do collapse into five decisions rather than seventy.

| Verdict | Branches | What it means |
|---|---|---|
| **already-landed** | 54 | Its PR merged. The commits are not ancestors of `main` because the merge was a squash, so "ahead of main" is an artifact and the content is there. Nothing to update. |
| **superseded** | 67 | PR closed, and every path it added is already on `main`. Nothing to update. |
| **NEEDS A PERSON** | 70 | PR closed, and it added at least one path `main` has never carried. |

**121 of 191 need no action at all.** That
is the answer to most of the question.

## Why "ahead of main" proves nothing here

54 of these branches have a **merged** pull request and still show commits
`main` lacks. That is not a discrepancy - it is what squash-merging does. The
branch's own commits never become ancestors of `main` even though every line
they contain is on it.

This repo has been caught by that before: an audit once reported 32 stale
branches when the real number was 3. `docs/SOP.md` SOP 7 exists because of it,
and the classification above uses the test that works - **which paths did the
branch add that `main` has never carried** - rather than ancestry.

## The 70 that need a person, grouped

They are not seventy decisions. They are five.

| Decision | Branches | New paths | What it is |
|---|---|---|---|
| **The July `feat/wave*` component series** | 52 | 258 | The 45 components that never landed |
| July research documents | 7 | 8 | Re-verification passes over the same 2026-07-15 leads |
| Weekly recaps and battle-file refreshes | 5 | 6 | Dated snapshots of a feed since shown to carry a volume bug |
| The stats API doc and its smoke test | 2 | 5 | Superseded by `docs/UPSTREAM-STATS-API.md` |
| Four one-offs | 4 | 6 | Listed below |

### The wave series is one decision and it is already documented

52 branches, 258 paths, and
`docs/BRANCH-AUDIT.md` already establishes what happened to them: **51 of the 53
pull requests carrying those components hit Vercel's free-tier limit of 100
deployments a day, and the closures cluster on two dates.** No hosted preview
was ever built for most of them.

**So "update them to main" is the wrong question for this group.** The question
is whether the work is wanted, and that has never been answered. If it is not,
they are deletable by the same proof that retired the 47. If it is, it is a
rebuild rather than a merge - they are fourteen months of drift behind a
codebase that has since changed its thesis.

### The four one-offs, which are the only ones needing individual thought

| Branch | Adds | PR |
|---|---|---|
| `feat/add-robots-and-sitemap` | 1 path(s) | CLOSED |
| `feat/community-verified-follow-up` | 1 path(s) | CLOSED |
| `feat/helius-battle-decode` | 1 path(s) | CLOSED |
| `rescue/1e49540-soltracker-main` | 3 path(s) | none |

`rescue/1e49540-soltracker-main` is the only branch here with **no pull request
at all**. It carries `RESUME.md` and `docs/AUDIT-2026-08-25.md` from the stale
`~/Documents/soltracker` clone and is superseded by
`docs/archive/2026-08-25-duplicate-clone-check.md`.

## How to update one, when a decision says to

Per the ruling: **never a rewrite of pushed history.** No rebase, no
force-push. Either

```
git checkout <branch> && git merge origin/main
```

or open a fresh PR carrying the same change against today's `main`. For a
branch fourteen months behind, the second is usually less work and always
easier to review.

## Reproduce

Classification, per branch:

```
base=$(git merge-base origin/main "origin/$b")
git diff --name-status --diff-filter=A "$base".."origin/$b" \
  | while read st f; do git cat-file -e "origin/main:$f" 2>/dev/null || echo "$f"; done
```

Conflict check, which touches no working tree:

```
git merge-tree "$base" "origin/$b" origin/main | grep -q '^<<<<<<<'
```

Run against a full clone. `git rev-parse --is-shallow-repository` returned
`false` and `main` had 412 commits when this was produced.
