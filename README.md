# wwtracker - WaveWarZ on-chain tracker

Next.js (App Router) dashboard tracking WaveWarZ on Solana - the platform
treasury wallet, the program's activity, and a trader's PnL - backed by Dune.

**Live:** https://wwtracker.vercel.app

WaveWarZ is a Solana music-battle platform: fans trade SOL on song-vs-song
battles. Program: `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`. Full research
in [docs/WAVEWARZ-RESEARCH.md](docs/WAVEWARZ-RESEARCH.md).

## Sections

Not tabs - one scrolling page, numbered 00-09, with a sticky jump-nav
(`components/AppShell.tsx`). Old `?tab=` links from before the redesign still
resolve to the right section.

- **00 Overview** - the landing view. Stat tiles (volume, treasury, battles,
  trades, traders, active days) plus a master chart overlaying volume /
  treasury / battles / trades (indexed to each line's own peak = 100% so they
  share one axis - no dual-y - with real numbers in the tooltip and per-line
  toggles).
- **01 What** - the WaveWarZ hub: what it is, how a battle works
  (buyShares/sellShares/endBattle/claimShares, 2-of-3 judging), the fee model, a
  live on-chain snapshot, key addresses (Solscan links), team, and official links.
- **02 Floor** - the treasury/dev wallet `FNj...` daily end-of-day SOL
  balance vs the 3.5 SOL operating floor. Bars = daily close; the line = intraday
  high (peaks that get skimmed before close - e.g. the wallet hit **4.65 SOL**
  intraday on 2026-06-13 but closed at 3.51). DAY / WEEK toggle. Live from Dune.
- **03 Growth** - true-scale cumulative SOL volume since launch, not indexed
  like the Overview chart - the actual shape of the platform's growth curve.
- **04 Profitability** - the floor model made visible: the 3.5 SOL operating
  floor, the distribution split (33% operations, 22% each to Hurricane / Candy /
  Zaal), a split pie, recipient cards (Solscan links when wallets are set), and a
  distribution history table. Config in `lib/distributions.ts`; rows show TBD
  until the real distribution dates/amounts + wallets are filled in.
- **05 Analytics** - WaveWarZ program-wide on-chain: 1,127 battles / 9,045 trades /
  122 traders (decoded instructions), battles-vs-trades timeline, daily activity
  (14,681 txs over 230 days since Aug 2025), treasury daily flow (lifetime net
  +3.51 SOL = the floor), and a top-traders leaderboard. Snapshot in `lib/wwData.ts`.
- **06 Battles** - the full battle history: search, filter by type, CSV export.
- **07 Traders** - the artist leaderboard, the full trader table, and a
  lookup for any wallet's own PnL (cumulative SOL, live from on-chain, win
  rate, biggest win/loss - shown alongside the stats-app's realized figure).
- **08 Music** - the songs and artists the battles are built on: song charts
  with Audius play counts + inline play, and the artist roster.
- **09 Ecosystem** - where WaveWarZ sits in the ZAO ecosystem, events, and FAQ.

Table features across those sections: client-side search/filter (songs, traders,
artists, battles), sortable columns (traders), and CSV export (leaderboard,
traders, battles) via the reusable `lib/csv.ts`.

## Streaming Overlay

- **[/overlay.html](/overlay.html)** - lower-third browser-source overlay for
  Restream / OBS. Shows live WaveWarZ data: 30-day volume, total battles, and
  today's transaction count. Values refresh automatically from the tracker's own
  snapshots every 90 seconds. Artist names via `?left=ARTIST1&right=ARTIST2&sub=TAGLINE`
  query params. Transparent background, reduced-motion safe, optimized for
  compositing over video.

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

## How it works

- `lib/dune.ts` - server-only Dune client. `getLatestBalances()` reads cached
  query results (cheap); `executeForWallet()` runs execute -> poll -> results for
  other wallets; `getCachedRows()` is the generic cached reader.
- `app/api/balance/route.ts` - holds the key server-side; `?wallet=` / `?mint=`
  validated as base58 before any credit is spent.
- `lib/wwData.ts` - baked Dune analytics snapshot; regenerate with
  `scripts/ww-research.sh` (needs `DUNE_API_KEY`).
- `vercel.json` - daily cron warms `/api/balance`.

## Environment

Copy `.env.example` to `.env.local`:

- `DUNE_API_KEY` - server-only, never exposed (no `NEXT_PUBLIC_`).
- `DUNE_QUERY_ID` - the daily-balance query (7717935).
- `DUNE_DEFAULT_WALLET` - the treasury wallet.

With env unset the dashboard still renders on deterministic sample data.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```

## Status / next

Done: scrolling-section dashboard, live treasury balance with intraday highs,
program analytics, live trader PnL, full research doc, profitability section
(floor + distribution split), table search/sort, CSV export across the data
tables, and a recap pipeline (fetch + Main Event/show/weekly draft generation).
Next: fill the distribution history + recipient wallets in
`lib/distributions.ts` to make the Profitability section real; per-battle PnL
+ win rate via buyShares/sellShares instruction decode; artist-payout tracing;
the X Spaces speaker log (Phase B of the recap pipeline).
