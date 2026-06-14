# wwtracker - WaveWarZ on-chain tracker

Next.js (App Router) dashboard tracking WaveWarZ on Solana - the platform
treasury wallet, the program's activity, and a trader's PnL - backed by Dune.

**Live:** https://wwtracker.vercel.app

WaveWarZ is a Solana music-battle platform: fans trade SOL on song-vs-song
battles. Program: `9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`. Full research
in [docs/WAVEWARZ-RESEARCH.md](docs/WAVEWARZ-RESEARCH.md).

## Tabs

- **Platform Floor** - the treasury/dev wallet `FNj...` daily end-of-day SOL
  balance vs the 3.5 SOL operating floor. Bars = daily close; the line = intraday
  high (peaks that get skimmed before close - e.g. the wallet hit **4.65 SOL**
  intraday on 2026-06-13 but closed at 3.51). DAY / WEEK toggle. Live from Dune.
- **Analytics** - WaveWarZ program-wide on-chain: daily activity (14,681 txs over
  230 active days since Aug 2025), treasury daily flow (lifetime net +3.51 SOL =
  the floor), and a top-traders leaderboard (treasury excluded). Snapshot in
  `lib/wwData.ts`.
- **My Trades** - a trader wallet's WaveWarZ PnL. Cumulative SOL PnL is live from
  on-chain (net -2.96 SOL across 518 txs), with SOL bet/returned, win rate, and
  biggest win/loss. Shown alongside the stats-app realized figure.

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
analytics, live trader PnL, full research doc. Next: per-battle PnL + win rate
via buyShares/sellShares instruction decode; artist-payout tracing; ops-budget
wallet + weekly-skim quantification.
