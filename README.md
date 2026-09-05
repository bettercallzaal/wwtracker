# wwtracker - WaveWarZ on-chain business layer

Next.js (App Router) dashboard for the WaveWarZ Solana music-battle platform.
The treasury wallet, the operating floor, the fee model, the business ledger,
and the program decoded instruction by instruction.

**Live:** https://wwtracker.vercel.app
Program: `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo` on Solana mainnet.

---

## Start here

**Read [docs/AUDIT.md](docs/AUDIT.md) first.** It is the current state of the
repo as of 2026-09-05: what is solid, what is weak, every finding ranked with
the command that produced it, and the roadmap in the order worth doing. If you
are picking this up cold, that document is the briefing and this file is the
map.

The three things to know before touching anything:

1. **wwtracker is the lab. wavewarz.info is production.** Experiments, research
   and documentation live here. Finished work moves across to
   `CandyToyBox/wavewarz-intelligence`, which is the system of record and fully
   in production. Push access granted 2026-09-05. Do not open speculative PRs
   against it.

2. **Nothing is baked that has a live source, and nothing is rebuilt that
   wavewarz.info already renders.** See "Why this matters" below for what
   happened when that rule did not exist.

3. **`CRON_SECRET` must be set in the Vercel project env**, or the daily cron
   401s and the treasury chart silently freezes. It already did, for 64 days.
   This is the highest value-per-minute item in the repo and it is not code.

## First five minutes

```bash
npm install
npm run validate     # data integrity + staleness gate
npx vitest run       # 275 tests
npm run dev          # needs .env.local, see Environment below
```

`npm run validate` is the fastest read on whether the data is healthy. It warns
at 14 days stale and fails at 45 under `--strict`.

## Where things are

| I want to... | Go to |
|---|---|
| Know the current state and what to work on | [docs/AUDIT.md](docs/AUDIT.md) |
| Understand how it is built | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Refresh the data | [docs/REFRESH.md](docs/REFRESH.md) |
| Understand WaveWarZ itself | [docs/WAVEWARZ-RESEARCH.md](docs/WAVEWARZ-RESEARCH.md) |
| See who owns which site | [docs/SURFACES.md](docs/SURFACES.md) |
| Use or extend the embeds | [lib/embeds.ts](lib/embeds.ts), gallery at `/embed` |

## Why this matters

wavewarz.info (the system of record for WaveWarZ) already renders the battles
table, leaderboards, songs, and artist pages. A second set of those numbers in
wwtracker would be a liability: the old tracker held a trader table that showed
the top trader down 19 SOL while wavewarz.info's own API had them up 30, and a
song list with 37 rows against the API's 934. So the rule now is: nothing here
is baked that has a live source on wavewarz.info, and nothing is rebuilt that
they already render. What is left is the part no other WaveWarZ surface shows:
the treasury, the operating floor, the fee model, the business ledger, and the
program itself decoded straight off Solana.

## Sections

Thirteen numbered sections (00-12) in one continuous scroll, with a sticky
jump-nav (`components/AppShell.tsx`). Old `?tab=` links still resolve to the
nearest surviving section. Each is a focused lens on one aspect of the business:

- **00 Overview** - every on-chain series at once. Volume, treasury, battles,
  trades: each line scaled to its own peak so they share one axis, with toggles
  and real numbers in the tooltip.
- **01 What** - what WaveWarZ is, battle mechanics (create / mint / trade /
  settle / claim), the fee model, live on-chain snapshot, key addresses, team,
  and official links.
- **02 Floor** - the treasury wallet's daily balance (close + intraday high) held
  against the 3.5 SOL operating floor. Live from Dune, refreshed every morning.
- **03 Growth** - cumulative SOL traded since launch in May 2025, at true scale.
- **04 Economics** - the fee schedule made visible: 1.5% per trade split in the
  artist's favour, the settlement waterfall, the skip-queue auction, and where
  every SOL goes.
- **05 Profitability** - once the wallet exceeds the floor, the surplus
  distributes as 33% operations, 22% each to Hurricane / Candy / Zaal.
- **06 Revenue** - real weekly inflow to the on-chain fee wallet, the trend, and
  the per-battle fee.
- **07 Operations** - real-world costs and income the team tracks manually (not
  on-chain-derivable): tech stack, monthly P&L, the fee wallet live balance.
- **08 Program** - the battle state machine as a funnel (create-mint-trade-settle-claim)
  with gap analysis, plus decoded program instructions. No other WaveWarZ surface
  shows this.
- **09 Market** - when money shows up, which artists pull it in, and how often
  the crowd is right - measured across every battle.
- **10 Embeds** - every chart here is a standalone iframe for embedding elsewhere.
- **11 Artists** - the roster (live from Audius), who they are, their releases,
  play totals and streaming stats.
- **12 Ecosystem** - where WaveWarZ sits in The ZAO ecosystem, events, FAQ.

## Embeds

- **Gallery** - section 10 shows every embeddable chart and counter. One line,
  no key, themed to the WaveWarZ design system.
- **Widget registry** - `lib/embeds.ts` declares what can be embedded
  (`/embed/<slug>`). Each entry is one chart or counter: treasury balance, daily
  activity, instruction-type mix, battles, volume, per-trader SOL, etc. Framing
  is CSP-restricted in `next.config.mjs`.
- **On-chain only** - the registry is weighted toward charts that only exist
  here: treasury, program activity, the operating floor. Battles, leaderboards,
  songs, and artist pages are on wavewarz.info - link to those instead of
  rebuilding them.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - how it's built: data paths, the
  sections, every metric's methodology, the Dune queries, deploy/env/security, and
  how to refresh the data.
- [docs/WAVEWARZ-RESEARCH.md](docs/WAVEWARZ-RESEARCH.md) - WaveWarZ domain
  research: program model, instruction discriminators, fee/settlement formulas,
  team, ecosystem, and on-chain findings.

## Recaps

Draft recap posts (Farcaster/X) for WaveWarZ battles - never auto-posted,
always human-reviewed.

- `npm run fetch:battles` - refreshes `public/ww-battles.json` from the live
  WaveWarZ Intelligence feed. Fails loud on any fetch/parse error rather than
  writing stale data.
- `npm run recap -- --battle <id> --type main-event` - drafts a recap for a
  specific Main Event battle (manually triggered - see
  `docs/superpowers/specs/2026-07-14-recap-pipeline-design.md` for why this
  can't be auto-detected).
- `npm run recap -- --show <space-url> --date <YYYY-MM-DD>` - drafts a recap
  for one of the 11 weekly shows (weekday 11am EST AMAs, 8:30pm EST Quick
  Battle nights).
- `npm run recap -- --weekly` - rolls up the trailing week into one recap.

Output lands in `recaps/battles/`, `recaps/shows/`, `recaps/weekly/` as
markdown files with a "Data used" section citing the exact source for every
number, and a "Not included" section for anything that can't be verified at
that granularity (no per-battle payout/trade data exists).

## Two data paths

The app uses two patterns, each fitted to its cost and freshness:

- **Live** - the treasury balance reads from Dune's cached results of saved query
  7717935 (no execution cost). The `/api/balance?refresh=1` endpoint (gated by
  `CRON_SECRET`) forces a re-run via `executeSavedQuery()` in `lib/dune.ts`.
  The daily Vercel cron hits this endpoint at 9 AM to refresh. Missing
  `CRON_SECRET` in the Vercel environment will cause the chart to silently
  freeze - this is the single most important operational detail in the repo.

- **Snapshots** - heavier analytics (instruction decode, PnL, volume, timelines)
  are Dune queries run offline via `scripts/ww-research.sh`, then baked into
  `lib/wwData.ts` by `scripts/ww-gen.py`. Components read directly from `wwData`
  - no request-time Dune calls, always instant, zero per-view cost. Live until
  manually refreshed.

Platform stats (battles, volume, artists, traders) come from wavewarz.info's
public API via `/api/ww/*` routes, cached and served through the tracker rather
than hitting the upstream API directly.

## Environment

Local development: copy `.env.example` to `.env.local` with:

- `DUNE_API_KEY` - server-only, never exposed (no `NEXT_PUBLIC_`).
- `DUNE_QUERY_ID` - the daily-balance query (7717935).
- `DUNE_DEFAULT_WALLET` - the treasury wallet.

Production (Vercel): set the same vars, plus:

- `CRON_SECRET` - the secret for the daily refresh cron. Without this the
  treasury chart will freeze. The cron hits `/api/balance?refresh=1` every
  morning at 9 AM; if this env var is unset the endpoint returns 401 and the
  chart silently goes stale.

Without env the dashboard renders on deterministic sample data.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

## Refresh & operations

- Most data auto-updates via live APIs or daily cron. The treasury balance is
  always current.
- Some data is baked snapshots: battles list, on-chain program analytics, artist
  and trader leaderboards. See `docs/REFRESH.md` for how to regenerate them.
- `scripts/validate.mjs` runs pre-build and warns if data is older than 14 days,
  flags stale at 45 days. Run with `--strict` to fail the build on staleness.
- `npm run fetch:battles` refreshes `public/ww-battles.json` from the live
  WaveWarZ Intelligence feed. Fails loud on any HTTP or parse error rather than
  writing stale data.
- `npm run recap` generates Farcaster/X draft recap posts for battles, shows, or
  a weekly rollup into `recaps/`. Every number cites its source file.
