# Branches provably empty against main, 2026-09-19

The record that has to exist **before** anything is deleted, so that any one of
these can be recreated from the sha below even after the remote ref is gone.

Zaal authorised the deletion conditionally: *"Delete if nothing important to
clean up repo."* This file is the "if nothing important" half, done first.

## The proof, and the two ways it can lie

For each branch below, run against **this repository, not a shallow clone**:

```
git rev-list --count main..origin/<branch>
```

**Zero means the branch holds no commit that `main` does not already have.**
Deleting the remote ref then loses nothing: every commit on it is reachable from
`main` and will still be.

**A shallow clone breaks this silently.** `git rev-list` over a truncated history
returns small counts for the same reason it returns nothing for an absent ref,
and a zero would be indistinguishable from the real answer. Verified here before
counting:

```
$ git rev-parse --is-shallow-repository
false
$ git rev-list --count main
383
```

**Use the ref form your clone actually has.** The commands here say `main`,
which resolves in a working clone where `main` is checked out. A review of
`BRANCH-AUDIT.md` hit this on a fresh clone that only had `origin/main` and had
to substitute by hand. **If `main` does not resolve, use `origin/main`
throughout** - the counts are identical, and a command that fails to resolve is
a command a reader cannot run.

**And a filter must be fed something it must find.** Two controls, both of which
must come back non-zero, or the test is broken rather than the branches empty:

| Control branch | `main..branch` |
|---|---|
| `ws/components-reason-unrecorded-2026-09-19` | 5 |
| `ws/readme-current` | 1 |

Each of the 47 tips was additionally checked with
`git merge-base --is-ancestor <sha> main`, and **all 47 passed** - the same fact
reached a second way.

## Why 47 and not 55

An earlier pass in `BRANCH-AUDIT.md` counted **55** branches as carrying nothing,
using a different test: every path the branch touches is byte-identical to
`main`. That is a weaker question, and it says yes to a branch that reverted its
own change, or that touched a file and put it back. **This count uses commits
rather than file contents, and it is the stricter of the two.** The eight-branch
gap is the difference between the tests, not a change in the repository.

That is the third time in one day that stating a selector precisely moved a
number. It is written down each time on purpose.

## The 47, with tip shas

Every one has **zero** commits absent from `main` and **no open pull request**.

| Branch | Tip sha |
|---|---|
| `chore/battles-refresh-2026-07-28` | `9b5a3c7689d4ca8a10c12ea5e3fbf0dc284bb99f` |
| `chore/validate-all-public-json` | `d2bd5438e76aa41c8b6cdfc880ebdda7b8f14441` |
| `chore/vercel-ignore-doc-builds` | `c86d6e669fc0123df97ef1c9a3906612ee2fbd2d` |
| `docs/community-research-closure-jul17` | `11912736216ef14bca292e90f0ce31eb6031d769` |
| `docs/community-research-dj-wavy-fan-content-2026-07-16` | `f3f6564a2e0acaa64ad101e651070fbc5cd66628` |
| `docs/refresh-battles-stats-runbook` | `ccac5562dccaedc0ea917d8c9b7cd2edd4f2bf1e` |
| `docs/research-doc-refresh-jul29` | `60f24a08b7e6f75e537488e137680515fa161054` |
| `feat/battles-community-tile` | `918ec54a5d5be141c929e4929d3c02a2d09e42c2` |
| `feat/battles-fetch-max-pages-flag` | `76cd713392c0d9123928ddcb35af040e946cd9f0` |
| `feat/case-study-page` | `94037874adfc3420e69c1d2e4aa665c9504ac9f8` |
| `feat/geo-robots-sitemap` | `1e75c6ff10bacc2a99de6b7f3785dba9a0391a11` |
| `feat/json-ld-dataset-schema` | `759d588def56c0b601a8dafaecdcdda1d9e91f90` |
| `feat/local-battles-stats-api` | `84b9f9cf3137fc08ba7a108b92f5141dd9d70492` |
| `feat/overlay-live-battle-stats` | `fae82edb6c84559c2f8c6e08ef5ff6a2ba05a863` |
| `feat/overview-scale-charts` | `59c3c869635258533016896e52af2851691c030d` |
| `feat/platform-growth-monthly-battles` | `c89f606333b0efa43de2a96dc6b4bcdc073bde75` |
| `feat/recap-consolidated-v2` | `1c173d42413add06c6ee6ecb1757cc95523a3072` |
| `feat/speaker-log-consolidated` | `49aad385900bb52b03de8a1f2049b928d02e600b` |
| `feat/stats-api-vitest-smoke` | `895f80bf066b505476b5590b59bcfb7e830342be` |
| `feat/wave28-fixes-freshness` | `1a1402a59824ee7016cdcf944e0ec2fd10c476f4` |
| `feat/wwtracker-llms-txt` | `b04ad001a1b1c613d8d9d926c66259834135ed48` |
| `fix/about-stale-comparison-numbers` | `16e313dcc737691b9e3f5bc5efc8fcc1bbcb6b90` |
| `fix/platform-revenue-optional` | `e2a22b896858e4853e685a5b7dacd91091118dda` |
| `test/suite-consolidated` | `128f820fb2bbd3c41218b1bd7795968bfd3aecbb` |
| `ws/api-factors-polymorphic` | `444ccc4bdeb9aad025703527954767b2920c93fb` |
| `ws/cached-stats-fanout` | `439dac38e76666dfa84c3db73043772d712a4173` |
| `ws/data-refresh` | `31ee0e1dc74061f3b64463bf451f4a5c4aac508e` |
| `ws/docs-ecosystem-sop-2026-09-19` | `4bb07f8217f5d06cdbe6d0d3cf00bff44d51c1ba` |
| `ws/docs-org-front-door` | `edf08158e5ac5c3d59e1ddaf84bcce710687ba35` |
| `ws/drop-cofounder-pnl` | `8f8ff9d5c4aa1f4f4d15358c740a43fcd4318b9b` |
| `ws/fix-price-test-hardcode` | `83a45049ec5ed534499aaeceaf3eb72d03be6d02` |
| `ws/fix-vercel-ignorecommand` | `c9e91200b7c81d96c89308fda644586c99f85b48` |
| `ws/lifecycle-and-visuals` | `d4ab06ec4fa6c1ccd589b52450eac6a7bb40ac63` |
| `ws/livewire-artist-leaderboard` | `cc0d4706517176cd9baae882d197601ac467b58e` |
| `ws/porting-doc` | `d4eafef2b6bc521d2d191ca2b8380c1669cb8757` |
| `ws/resolve-duplicate-stats-endpoints` | `e27296c3569e5d725053dfad4187dbd50ba13cee` |
| `ws/sop7-name-the-file-2026-09-19` | `c8718b8ee2b19e2e95b1b7e2bc71500a83232531` |
| `ws/weekly-revenue-analytics` | `2c762aea36f584c71f5adb83ec61c7474c78389e` |
| `ws/worktrail-audit-2026-09-19` | `c22d8e2c2235ac44a4b6a678523135a3b116136c` |
| `ws/ww-asset-registry-2026-09-18` | `0083bfdf9f3737de5ea8e99328e3875ad2f70f39` |
| `ws/ww-battle-record-2026-09-18` | `1e61fae3e6503c23f900f32de7811b5c6377e18d` |
| `ws/ww-claim-panel-2026-09-18` | `f11cc5f6ab9cd35861e6f9be52c19200a06f6ee1` |
| `ws/ww-claimable-token2022-2026-09-18` | `54a38c71e7f3eaa61eac74e1e44db1842f5b770c` |
| `ws/ww-fresh-quote-2026-09-18` | `1e2a1a859314c3677eb5e6a1f7e3b76d7acb03b9` |
| `ws/ww-price-impact-2026-09-18` | `78274a81c8312501710e18000c491dbf253fc941` |
| `ws/ww-sdk-boundary-2026-09-18` | `4bae0a77face382782552d86ef3c7b016fbc47bd` |
| `ws/ww-token-eligibility-2026-09-18` | `2a09a757a32ae0af3fd1fef7770784bd87df734e` |

## Not deleted

**192 other remote branches carry at least one commit `main` does not
have**, and this touches none of them. They are not all live work - many are old
and some will never merge - but "holds a commit main lacks" is the line, and
anything above it needs a person rather than a script.

`ws/readme-current` is one of them, and Zaal has separately asked for it to be
brought up to main rather than deleted.

## What happens next

Nothing in this file deletes anything. When Zaal says the word, each ref goes with

```
git push origin --delete <branch>
```

and any of them comes back with

```
git branch <branch> <tip sha>
git push origin <branch>
```
