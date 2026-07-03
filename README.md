# wwtracker - WaveWarZ on-chain tracker

Next.js (App Router) dashboard tracking WaveWarZ on Solana - the platform
treasury wallet, the program's activity, and a trader's PnL - backed by Dune.

**Live:** https://wwtracker.vercel.app

WaveWarZ is a Solana music-battle platform: fans trade SOL on song-vs-song
battles. Program: `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`. Full research
in [docs/WAVEWARZ-RESEARCH.md](docs/WAVEWARZ-RESEARCH.md).

## Tabs

- **Overview** - the landing view. Every on-chain series in one place: stat tiles
  (volume, treasury, battles, trades, traders, active days), a master chart
  overlaying volume / treasury / battles / trades (indexed to each line's own peak
  = 100% so they share one axis - no dual-y - with real numbers in the tooltip and
  per-line toggles), then two true-scale SOL charts - cumulative volume from zero,
  and treasury balance against the 3.5 floor. Closes with the cofounder's live
  net-negative trading PnL.
- **About** - the WaveWarZ hub: what it is, how a battle works
  (buyShares/sellShares/endBattle/claimShares, 2-of-3 judging), the fee model, a
  live on-chain snapshot, key addresses (Solscan links), team, and official links.
- **Platform Floor** - the treasury/dev wallet `FNj...` daily end-of-day SOL
  balance vs the 3.5 SOL operating floor. Bars = daily close; the line = intraday
  high (peaks that get skimmed before close - e.g. the wallet hit **4.65 SOL**
  intraday on 2026-06-13 but closed at 3.51). DAY / WEEK toggle. Live from Dune.
- **Analytics** - WaveWarZ program-wide on-chain: 1,127 battles / 9,045 trades /
  122 traders (decoded instructions), battles-vs-trades timeline, daily activity
  (14,681 txs over 230 days since Aug 2025), treasury daily flow (lifetime net
  +3.51 SOL = the floor), and a top-traders leaderboard. Snapshot in `lib/wwData.ts`.
- **My Trades** - a trader wallet's WaveWarZ PnL. Cumulative SOL PnL is live from
  on-chain (net -2.96 SOL across 518 txs), with SOL bet/returned, win rate, and
  biggest win/loss. Shown alongside the stats-app realized figure.
- **Profitability** - the floor model made visible: the 3.5 SOL operating floor,
  the distribution split (33% operations, 22% each to Hurricane / Candy / Zaal),
  a split pie, recipient cards (Solscan links when wallets are set), and a
  distribution history table. Config in `lib/distributions.ts`; rows show TBD
  until the real distribution dates/amounts + wallets are filled in.
- **Leaderboard / Songs / Traders / Battles / Artists** - the data views. Artist
  leaderboard, the song charts (Audius play counts + inline play), the trader
  table, the full battle history, and the Audius-backed artist roster.

Table features across those views: client-side search/filter (songs, traders,
artists, battles), sortable columns (traders), and CSV export (leaderboard,
traders, battles) via the reusable `lib/csv.ts`.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - how it's built: data paths, the
  tabs, every metric's methodology, the Dune queries, deploy/env/security, and how
  to refresh the data.
- [docs/WAVEWARZ-RESEARCH.md](docs/WAVEWARZ-RESEARCH.md) - WaveWarZ domain
  research: program model, instruction discriminators, fee/settlement formulas,
  team, ecosystem, and on-chain findings.

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

Done: multi-tab dashboard, live treasury balance with intraday highs, program
analytics, live trader PnL, full research doc, profitability tab (floor +
distribution split), table search/sort, CSV export across the data tables. Next:
fill the distribution history + recipient wallets in `lib/distributions.ts` to
make the Profitability tab real; per-battle PnL + win rate via
buyShares/sellShares instruction decode; artist-payout tracing.
