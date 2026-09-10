# Session handoff - 2026-09-09 12:30 UTC

> from mac / wwtracker `main` -> to Zaal on his desktop, or a fresh CC terminal
> doc: `docs/handoffs/2026-09-09-correction-reach.md`
> chain: none

Committed rather than left in `.handoffs/` because that path is gitignored
(`.gitignore:24`), so a bundle written there does not exist on any other
machine. This one is readable from a clone.

## Receiver instructions (read me FIRST, then do exactly this)

You just received a handoff bundle. Do NOT start work yet.

1. Read all sections below (A through E) before responding to anything.
2. Section C has no diff to apply - both repos are clean.
3. Create TaskList entries from section A.
4. Use section B as your "why". Do not re-litigate what is captured there.
5. Section D says what is running: nothing.
6. Use section E as the cold-start map.
7. Once integrated, say: "Ingested handoff 2026-09-09-correction-reach. N tasks queued. Ready."

**The lane is PARKED for maintenance mode. ZAOstock is the priority - the form
goes out and the pitch deck gets finalised. Do not start work in this repo
unless ZAOstock needs it.** Everything in section A is dated and enforced by
`validate --strict`, so it fails the build rather than relying on memory.

## A. Tasks to absorb

- [ ] **2026-09-13, before the Grand Final** - re-run `pmset -g` and
      `zao-measure --verify "wwtracker: trader P&L restore verdict"`. Both are
      enforced by `validate --strict`; CI fails if either passes unattended.
      *(Corrected 2026-09-10: this named the "condition" label, which records
      figures and so says DRIFTED on any movement - it did, with all four
      conditions PASS. Both re-run early on 09-10: `sleep 1`, SAFE TO SHOW.)*
- [ ] **2026-09-13** - watch `/live` during the Grand Final:
      `npm run watch:live`. The launchd installer works but nothing has started
      it; that is Zaal's opt-in, not a default.
- [ ] **2026-09-14** - delete the disclosed Helius key, confirm it 401s, and
      create a **second** key so scans stop sharing a budget with the production
      `/live` page. Runbook in `docs/RECHECK.md`.
- [ ] **2026-10-08** - re-check `SOL_USD` in `lib/price.ts`.
- [ ] **Candy's, not ours** - her claims gap-fill reports 65 battles with zero
      claims on chain; the complete scan says 18. The list she can diff against
      is committed at
      `wavewarz-protocol/data/chain-snapshot-2026-09-06/zero-claim-battles.txt`.
- [ ] **Zaal's alone** - `coordination/CANDY-LEDGER.md` row 25, the
      IDL-in-public-git-history security question.

## B. Why - decisions, findings, and the friction

**The session found one defect class seven times: a correction that reached one
consumer and not another.** That is the thing worth carrying; the individual
fixes matter less than the shape.

| what was corrected | who kept the old value |
|---|---|
| Dune has `sells`/`claims` transposed (measured 2026-09-08) | the instruction-mix embed, `BattleLifecycle`, `PlatformAnalytics`, and `ww-gen.mjs`'s own `timeline` block - in the file whose comment read *"corrected here, at the boundary"* |
| trade fee is 1.500% split 67/33, not 1.00/0.50 | `lib/feeModel.ts` plus four rendered surfaces, while a test asserted the correct figures against the case-study prose only |
| launch fees measured 2026-09-06 as NEVER COLLECTED | `platformRevenue()` still summed them, putting **TOTAL PLATFORM REVENUE 1,052.879 SOL** on the homepage against a measured **19.38** |

- **The corrections are placement now, not rules.** `lib/onchainDaily.ts` is the
  only way to read the transposed file, and a test fails the build on any direct
  fetch of that path. `ww-gen.mjs` swaps at the read so `active`, `timeline` and
  `program` all derive from corrected rows. Every stated figure derives from
  `lib/measured.ts`.
- **A guard that names FILES is a list of what somebody remembered.** Three
  guards passed all day while what they guarded was wrong, each for that reason.
  The value registry in `lib/__tests__/supersededFigures.test.ts` is the one that
  works, because it fails wherever a retired figure turns up. Put retired values
  there, not in a per-file check.
- **Rendering the page caught almost everything; the gates caught almost
  nothing.** Including a bug introduced during this session that passed
  typecheck and 494 tests: `${...}` inside a double-quoted string renders as
  literal characters and is valid TypeScript. Three of the seven only surfaced
  because Zaal asked for another look after the fix had been reported done.
- **Verify a guard by breaking it.** Both new guards were checked by
  reintroducing the fault and watching them fail, then restoring. A guard nobody
  has seen fail is not yet a guard.
- **The battle file was rebuilt from the platform's public API**, not the
  intelligence app's HTML: **1,290 to 1,510 battles, 412.38 to 923.10 SOL**,
  matching the platform to the lamport. The old fetcher walked pages until one
  added nothing new, which assumes everything missing is newer than everything
  held - the 213 absent battles were spread across every month since launch.
- **It merges rather than replaces** because the API is not strictly better: it
  returns `winnerSide: null` for 239 battles and we already held a winner for
  216. Pool size does not recover it (battle 1787370496 has both pools at exactly
  0.0493), so an API null never overwrites a value we hold.
- **Ruled out:** deleting the HTML scraper. It supplies a winner for 214 battles
  the API leaves null, so it survives behind `npm run fetch:battles --
  --fill-winners`, off by default (70-odd requests against 8).

### Friction worth not rediscovering

- **Both browser bridges were down all day** - Playwright MCP returned
  "Extension connection timeout" and Chrome MCP was unavailable. The workaround
  that carried the whole session is the Playwright-cached headless Chromium:

      SHELL=$(find ~/Library/Caches/ms-playwright/chromium_headless_shell-1208 \
        -type f -name chrome-headless-shell | head -1)
      "$SHELL" --headless --disable-gpu --hide-scrollbars \
        --virtual-time-budget=25000 --window-size=560,340 \
        --screenshot=/tmp/shot.png https://wwtracker.vercel.app/embed/<slug>

  Add `--dump-dom` instead of `--screenshot` to grep the rendered HTML. Budgets
  under ~15s cut remote images off; 25-30s is reliable.
- **`npm run check` runs `next build` into the same `.next` as a running
  `npm run dev`**, which breaks the dev server with `MODULE_NOT_FOUND` and
  renders blank pages. Restart dev after any check; a blank screenshot is
  usually this and not a real bug.
- **`lib/__tests__/stats-api.test.ts` hits the live network** with a 5s timeout
  and flakes. It passes on rerun. Not a signal.
- **Compound `sleep N; <cmd>` is blocked** by the harness. Use
  `run_in_background` with an `until` loop.

## C. Git state

Both repos clean, nothing to apply.

- `wwtracker` - branch `main`, 0 dirty, 0 unpushed, 0 open PRs
  - HEAD when this was written: `35fa73f` (#270). **This bundle's own commit
    lands after that**, so the sha above is one behind by construction, not
    stale - a document cannot name the commit that adds it. For the real head,
    run `git log --oneline -1`. The PR list below is the durable record.
- `wavewarz-protocol` - branch `main`, 0 dirty, 0 unpushed, 0 open PRs
- `zao-vault` - lane brief, `handoffs/status/wwtracker.md` and the IN-FLIGHT row
  committed and pushed. Other lanes have work in flight there; it was left alone.

`npm run check` at park: typecheck clean, **495 tests**, build compiles,
`validate --strict` exit 0.

**Merged in this session** - wwtracker #265 #266 #267 #268 #269 #270 #271, and
wavewarz-protocol #3 #4 #5 #7. (#271 is this bundle; protocol #6 landed at
10:13 UTC, just before this session picked up.)

Untracked files: none.

## D. In-flight

Nothing. No background jobs, no subagents, no scheduled wakeups, no open
question. Dev servers stopped.

Two protocol branches (`recon/round-2-candy`, `recon/round-2-zaal-reply`) are
fully merged into main and are not this lane's - left alone deliberately.

## E. Cold-start map

**Files touched this session, by topic:**

- Embeds - `components/embeds/Widgets.tsx` (instruction mix reads the chain scan;
  treasury moved to `ComposedChart` so its second series actually draws; axis
  widths; avatars with a fallback; as-of notes), `lib/embeds.ts`,
  `public/ww-instruction-mix.json` (new, generated offline)
- The transposition boundary - `lib/onchainDaily.ts` (new),
  `components/BattleLifecycle.tsx`, `components/PlatformAnalytics.tsx`,
  `scripts/ww-gen.mjs`, `lib/wwData.ts`
- Battles - `scripts/ww-battles-fetch.ts` (rewritten against the public API),
  `scripts/recap/battles-from-api.ts` (new), `scripts/recap/types.ts`,
  `scripts/recap/format.ts`, `public/ww-battles.json`, `lib/freshness.ts`;
  `scripts/recap/merge-battles.ts` deleted (no caller left)
- Fee rate - `lib/feeModel.ts`, `components/FeeModel.tsx`,
  `components/HowItWorks.tsx`, `components/AboutWaveWarZ.tsx`,
  `components/OnChainProof.tsx`, `components/Faq.tsx`,
  `app/tournament/page.tsx`, `docs/ARCHITECTURE.md`, `docs/LAUNCH-FEES.md`,
  `docs/UPSTREAM-STATS-API.md`
- Derived figures - `lib/measured.ts`, `app/case-study/page.tsx`,
  `app/ecosystem/page.tsx`, `lib/surfaces.ts`
- Guards - `lib/__tests__/supersededFigures.test.ts`, `measured.test.ts`,
  `feeRates.test.ts`, `feeModel.test.ts`, `duneTransposition.test.ts`,
  `onchainDaily.test.ts` (new), `embedInstructionMix.test.ts` (new),
  `scripts/recap/__tests__/`, `scripts/validate.mjs`
- Protocol - `tools/instruction-mix-from-chain.py` (new), `STATE.md`

**Skills invoked:** `/handoff` - once, this bundle.

**Memory writes:** none.

**Last-known mental model:** a request to review the embed page turned into
seven instances of one defect class and ten merged PRs. It ended by moving the
corrections out of prose and into places that cannot be walked past, and by
re-parking the lane. Nothing is in progress.

**Open questions for the receiver:**

- The buys residual in AUDIT 3.8 is still open: 9,297 on chain against Dune's
  9,646, one-directional, probably failed transactions. Not answerable from our
  side.
- The intelligence app and the platform API disagree about 184 battles - one
  calls them decided, the other does not. Nothing here adjudicates that.

## Inline copy-paste block

```
Ingest the bundle at docs/handoffs/2026-09-09-correction-reach.md in bettercallzaal/wwtracker and follow the receiver instructions at the top. Lane is PARKED for maintenance mode; 6 dated tasks to absorb, none before 2026-09-13.
```
