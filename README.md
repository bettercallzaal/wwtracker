# SolTracker

Next.js (App Router) dashboard that tracks a Solana wallet's daily end-of-day
SOL balance, backed by a saved Dune query. Renders an area chart, a current
balance hero, and stat tiles (30d change, ATH, days tracked). Falls back to
deterministic sample data when Dune is not configured.

## How it works

- `lib/dune.ts` - server-only Dune client. Two paths:
  - `getLatestBalances()` reads the CACHED results of the saved query (cheap, no
    credit per call) - used for the default wallet on native SOL.
  - `executeForWallet()` runs the EXECUTE -> poll status -> fetch results flow
    for any other wallet or SPL mint, with a 12h in-memory TTL cache keyed by
    wallet+mint to avoid repeat executes. Polling is capped at ~60s.
- `app/api/balance/route.ts` - holds the key server-side, reads `DUNE_API_KEY`,
  `DUNE_QUERY_ID`, `DUNE_DEFAULT_WALLET`. Accepts `?wallet=` and `?mint=`,
  validates both as base58 Solana addresses before spending a credit.
- `components/BalanceDashboard.tsx` - client component. Wallet input + SOL/SPL
  toggle, loading skeletons, error panel with retry, live/sample/error badge.
- `vercel.json` - daily cron warms `/api/balance` at 09:00 UTC.

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `DUNE_API_KEY` - server-only, never exposed to the client (no `NEXT_PUBLIC_`).
- `DUNE_QUERY_ID` - the saved query id.
- `DUNE_DEFAULT_WALLET` - the wallet the cron warms (uses the cached path).

With env unset the dashboard still renders on sample data.

## Dune query contract

The saved query takes a `wallet` parameter (and optional `mint`) and returns one
gap-filled row per day, ordered by `block_date` ascending, with the closing
balance carried forward on no-activity days. Source table:
`solana.account_activity` (`post_balance / 1e9` for native SOL,
`post_token_balance` for SPL). Result columns: `block_date` (YYYY-MM-DD) and the
end-of-day balance under `eod_sol_balance` (native) or `eod_token_balance` (SPL);
the client accepts either.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build
```

## Changelog (this build)

- Multi-wallet: `?wallet=` accepted and validated as base58; default wallet uses
  cached results, any other wallet triggers the Dune execute path with a 12h
  in-memory TTL cache.
- SPL toggle: SOL/SPL switch in the UI; `?mint=` forwarded to Dune as a second
  parameter; labels switch between the SOL glyph and the token symbol.
- State + a11y: real loading skeletons, explicit error panel with retry (no more
  silent sample fallback on explicit queries), keyboard focus styles,
  `prefers-reduced-motion` respected (chart animation off), responsive to ~360px.
