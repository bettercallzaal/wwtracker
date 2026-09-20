# Next.js 14 to 16: what actually breaks

**2026-09-20.** Zaal ruled to run the codemod and produce this list, landing
nothing, and to decide ship timing against what breaks rather than against the
idea of it. This is that list. **Nothing in this document has been applied to
`main`.** It was measured in a throwaway worktree that has since been deleted.

## The short version

**The upgrade is seven files and all seven changes are mechanical.** No
rewrite, no architectural change, no new API to learn. The build passes, the
typecheck passes, and 929 of 930 tests pass - the one failure is our own guard
and is discussed below.

**It is not one major version, it is two.** `next@16` requires React 19, so
`react` and `react-dom` go 18.3.1 to 19 in the same step. That is the part
worth pricing, because it is where the third-party risk lives.

## What it fixes

    before: 1 critical, 2 high, 2 moderate
    after:  0 critical, 0 high, 2 moderate

The critical is `next` itself, carrying **seventeen** advisories at
`14.2.35` - request smuggling in rewrites, cache poisoning in middleware
redirects and in RSC responses, SSRF via WebSocket upgrades and via Server
Actions on custom servers, XSS in App Router apps using CSP nonces, and several
denial-of-service paths through the image optimizer and Server Components.
`npm audit` names `16.3.5` as the fix and flags it `isSemVerMajor`.

**The two that remain are `vitest` and `@vitest/mocker`, both moderate, both
dev-only.** They do not ship. They are fixable separately and should not be
bundled into this decision.

## The seven files

**Two take `params` synchronously, and in 15+ it is a Promise.**

    app/api/audius/tracks/[id]/route.ts    { params }: { params: { id: string } }
    app/artist/[handle]/layout.tsx         params: { handle: string }

Both become `Promise<{...}>` and `await`. **Everything else was already
correct** - `app/api/ww/leaderboards/[kind]`, `app/surface/[slug]`,
`app/widget/[battleId]` already declare Promises, `cookies()` is already
awaited in all three admin routes, and `app/artist/[handle]/page.tsx` and
`app/embed/[slug]/page.tsx` use the client `useParams()` hook, which is
unaffected. So the blast radius of the headline breaking change is two files.

**Five export `revalidate` as a computed constant, and 16 requires a literal.**

    app/api/blog/route.ts                  REVALIDATE           -> 1800
    app/api/ww/battle/route.ts             REVALIDATE           -> 20
    app/api/ww/leaderboards/[kind]/route.ts REVALIDATE_SECONDS  -> 60
    app/api/ww/stats/route.ts              REVALIDATE_SECONDS   -> 60
    app/paper/page.tsx                     PAPER_REVALIDATE_SECONDS -> 3600

The failure mode is unhelpful: the build prints `Invalid segment configuration
export detected. You should see the relevant failures in the logs above` and
there are no failures in the logs above. It names no file. Finding the five
meant grepping for every segment export by hand.

### The near-miss in that list, which is the reason to be careful here

**Substituting a literal means reading the constant, and I got one wrong on the
first pass.** I typed `30` for `REVALIDATE_SECONDS`, which is `60`. Both
values build, both pass every test, and nothing anywhere would have reported
it. It would have silently halved the cache TTL on two public API routes -
`/api/ww/stats` and `/api/ww/leaderboards/[kind]`, the two Candy's surfaces
read - doubling origin traffic with no error to trace it by.

**This is the actual risk of the upgrade.** Not that it fails to compile. That
a mechanical edit made in a hurry changes a production number, passes every
gate, and surfaces as a load problem weeks later. Whoever applies these five
reads each constant and writes the value it holds, and a reviewer checks the
five numbers against the five constants rather than checking that it builds.

## Three things that do not block but are real

**`recharts@2.12.7` does not support React 19.** Its peer range is
`^16 || ^17 || ^18`. `npm install` proceeds with a warning, the build passes,
and the charts are running on an unsupported combination - which is a thing
that works until it does not, with no warning at runtime. `recharts@3.10.1`
declares `^19` support. **That is a third major bump with its own API changes
and it is not in the seven files above.** Either accept the unsupported peer
knowingly, or price the recharts 2 to 3 migration as part of this.

**The Edge Runtime is deprecated.** `app/opengraph-image.tsx` exports
`runtime = "edge"`. It builds and runs; Next prints a deprecation notice
pointing at the `nodejs` runtime. Not urgent, and worth doing while the file is
open rather than at the next major.

**`next build` rewrites `tsconfig.json` without asking**, setting `jsx` to
`react-jsx` and adding `.next/dev/types/**/*.ts` to `include`. Expect that diff
and commit it deliberately rather than discovering it in an unrelated PR.

## One collision with our own rules

`wwPaperFigures.test.ts` fails, and it is right to.

It reads `app/paper/page.tsx` and asserts the page source contains **no numeric
literal that looks like a platform figure**, so that no sentence can hard-code a
number the figures compute. Next 16 requires `export const revalidate = 3600`
in that exact file, and the guard sees `3600`.

**Both rules are correct and they want opposite things in one file.** The fix
is to narrow the guard to exempt a route segment config export - it is
configuration, not prose, and no reader sees it - and to say so in the test, so
the exemption reads as a decision rather than as a hole somebody widened to get
a build green.

## What I would do

**Apply the seven, hold the recharts question.** The seven are mechanical and
remove seventeen advisories including a critical. The React 19 peer on recharts
is the only genuinely open risk, and it is a risk that exists the moment React
19 lands, whether or not recharts is upgraded in the same change.

**If this goes in before the festival, the thing to verify by hand is the
charts**, because that is the one surface the type checker and the test suite
cannot speak for. Everything else here is covered by a gate.

## Reproduce

    git worktree add ../audit-next16 -b audit/next16 origin/main
    cd ../audit-next16 && npm install
    npm install next@16.3.5 react@19 react-dom@19
    npm run build            # fails: segment config, then params
    grep -rn "^export const \(revalidate\|dynamic\|runtime\)" app
