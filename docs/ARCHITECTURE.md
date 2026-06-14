# wwtracker - Architecture & Build Documentation

How the WaveWarZ tracker is built, where the data comes from, and how every
number on the dashboard is produced. Companion to
[WAVEWARZ-RESEARCH.md](WAVEWARZ-RESEARCH.md) (the WaveWarZ domain research).

- Live: https://wwtracker.vercel.app
- Repo: https://github.com/bettercallzaal/wwtracker
- Stack: Next.js 14 (App Router) + React 18 + recharts. TypeScript throughout.
  No UI framework - inline styles + a shared palette (`lib/theme.ts`).

---

## 1. What it is

A read-only dashboard for WaveWarZ (a Solana music-battle betting platform). It
surfaces three things: the platform treasury wallet's balance, program-wide
on-chain activity, and a single trader's PnL. All data is derived from
[Dune Analytics](https://dune.com) queries over the WaveWarZ program
`9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`.

## 2. Repo layout

```
app/
  layout.tsx            root layout + metadata
  page.tsx              renders <AppShell/>
  globals.css           palette vars, reduced-motion, focus, skeleton shimmer
  api/balance/route.ts  GET endpoint: treasury daily balance (live, server-side)
components/
  AppShell.tsx          tab switcher (About / Platform Floor / Analytics / My Trades) + footer
  AboutWaveWarZ.tsx     the hub: what it is, mechanics, fees, snapshot, addresses, team, links
  BalanceDashboard.tsx  Platform Floor: close bars + intraday-high line vs 3.5 floor
  PlatformAnalytics.tsx Analytics: decoded instruction mix, timeline, activity, treasury flow, volume, leaderboard
  TraderScorecard.tsx   My Trades: live PnL, win rate, monthly PnL, biggest moves, footprint
lib/
  dune.ts               server-only Dune client (live reads + execute path)
  solana.ts             base58 address validation
  theme.ts              shared palette + label style
  wwData.ts             GENERATED on-chain analytics snapshot (do not hand-edit)
  sampleData.ts         deterministic fallback balance series
  traderSample.ts       deterministic fallback PnL curve
scripts/
  ww-research.sh        run the core Dune queries -> /tmp/ww-*.json (needs DUNE_API_KEY)
  ww-gen.py             read /tmp/ww-*.json -> regenerate lib/wwData.ts
docs/
  WAVEWARZ-RESEARCH.md  domain research (program model, fees, team, findings)
  ARCHITECTURE.md       this file
vercel.json             framework pin + daily cron warming /api/balance
```

## 3. Two data paths

The app deliberately uses two different mechanisms, by cost and freshness:

**A. Live path (treasury balance).** `app/api/balance/route.ts` calls
`lib/dune.ts:getLatestBalances()`, which reads the *cached results* of saved Dune
query `7717935` (cheap - no query execution per request). The key lives only in
this server route. The fetch uses `cache: "no-store"` so Vercel's persistent Data
Cache cannot pin a stale copy across deploys. The client component fetches
`/api/balance`; if env is unset the route returns 503 and the component falls back
to `sampleData.ts`.

**B. Snapshot path (everything else).** The heavier analytics (instruction decode,
PnL, volume, timelines) are computed by running Dune queries offline via
`scripts/ww-research.sh`, then baked into `lib/wwData.ts` by `scripts/ww-gen.py`.
Components import `WW` from `lib/wwData.ts` directly - no request-time Dune calls,
always fast, zero per-view credit cost. `WW.generatedAt` stamps the snapshot.

Why two paths: the treasury balance should be current (live cached read is cheap);
the analytics are expensive Solana scans, so we snapshot them and refresh on demand.

## 4. The tabs

| Tab | File | Shows | Source |
|-----|------|-------|--------|
| About | AboutWaveWarZ.tsx | What WaveWarZ is, battle flow, fee table, live snapshot, addresses, team, ecosystem, links | WW + static |
| Platform Floor | BalanceDashboard.tsx | Treasury daily close (bars) + intraday high (line) vs 3.5 floor; Day/Week; ATH/30d/days tiles | live /api/balance |
| Analytics | PlatformAnalytics.tsx | Decoded battles/trades/claims/traders, battles-vs-trades timeline, daily activity, treasury flow, buy-volume chart, tx-count leaderboard | WW |
| My Trades | TraderScorecard.tsx | Live cumulative SOL PnL, win rate, SOL bet/returned, biggest moves, monthly PnL, platform footprint | WW |

## 5. Metrics & methodology

Every number traces to a Dune query over `solana.instruction_calls` (tx_signer,
executing_account, `data`) and/or `solana.account_activity` (address,
post_balance, balance_change). Program = `9TUf...`, treasury = `FNj...`, the
tracked trader = `4aY1...`.

- **Treasury close / intraday high** - `account_activity` for `FNj`:
  `max_by(post_balance, block_time)` per day = close; `max(post_balance)` =
  intraday high (captures peaks skimmed before close, e.g. 4.65 SOL on 06-13).
  Gap-filled forward over a date spine. Query `7717935` (the live one).
- **Instruction mix** - decode the 8-byte Anchor discriminator with
  `to_hex(bytearray_substring(data,1,8))` and map to IDL names. All six verified.
  Counts: 1,127 battles created / 1,110 settled, 6,914 buys + 2,131 sells, 2,299
  claims, 122 unique traders.
- **Trader PnL (flow-based)** - for every WaveWarZ tx the wallet signs, take its
  `balance_change` on `account_activity`. Cumulative sum = realized net SOL
  (-2.96). Win rate = share of positive-delta txs (35.7%). Independent of the
  bonding-curve math; differs from the stats app's per-battle realized figure.
- **Platform buy volume** - join `account_activity` (signer's negative delta) to
  the set of `buyShares` txs by `tx_id`+`tx_signer`. Sum = SOL committed on buys
  (324.62; includes ~1.5% fees + gas). Buy-side only; the app reports 483.88
  both-sides.
- **Monthly PnL / biggest moves / footprint** - all derived from the same per-tx
  delta list.

## 6. The Dune queries

`scripts/ww-research.sh` runs these (reusing one scratch query id, then fetching
results). Key program/wallets are constants; the API key comes from
`$DUNE_API_KEY`.

```sql
-- daily program activity
SELECT block_date, count(distinct tx_id) AS txs, count(distinct tx_signer) AS traders
FROM solana.instruction_calls
WHERE executing_account = '<PROGRAM>' AND block_date >= date '2025-08-01'
GROUP BY 1 ORDER BY 1;

-- instruction-type decode
SELECT to_hex(bytearray_substring(data,1,8)) AS disc, count(*) AS calls,
       count(distinct tx_signer) AS signers
FROM solana.instruction_calls
WHERE executing_account = '<PROGRAM>' AND block_date >= date '2025-08-01'
GROUP BY 1 ORDER BY 2 DESC;

-- trader per-tx SOL delta (cumulative = realized PnL)
WITH ww AS (
  SELECT distinct tx_id FROM solana.instruction_calls
  WHERE executing_account='<PROGRAM>' AND tx_signer='<TRADER>' AND block_date >= date '2025-08-01')
SELECT aa.block_time, aa.balance_change/1e9 AS sol_delta
FROM solana.account_activity aa JOIN ww ON aa.tx_id=ww.tx_id
WHERE aa.address='<TRADER>' ORDER BY aa.block_time;

-- treasury daily flow
SELECT block_date,
  sum(case when balance_change>0 then balance_change else 0 end)/1e9 AS inflow,
  sum(case when balance_change<0 then -balance_change else 0 end)/1e9 AS outflow,
  sum(balance_change)/1e9 AS net
FROM solana.account_activity WHERE address='<TREASURY>' GROUP BY 1 ORDER BY 1;

-- platform daily buy volume (flow-based)
WITH buy_tx AS (
  SELECT DISTINCT tx_id, tx_signer FROM solana.instruction_calls
  WHERE executing_account='<PROGRAM>'
    AND bytearray_substring(data,1,8)=from_hex('28ef8a9a08256a6c')  -- buyShares
    AND block_date >= date '2025-08-01')
SELECT aa.block_date, sum(-aa.balance_change)/1e9 AS buy_volume, count(distinct aa.tx_id) AS buys
FROM solana.account_activity aa JOIN buy_tx b ON aa.tx_id=b.tx_id AND aa.address=b.tx_signer
WHERE aa.balance_change < 0 GROUP BY 1 ORDER BY 1;
```

The Dune REST flow per query: `POST /v1/query` (create) or `PATCH /v1/query/{id}`
(update SQL) -> `POST /v1/query/{id}/execute` -> poll `GET /v1/execution/{id}/status`
until `QUERY_STATE_COMPLETED` -> `GET /v1/execution/{id}/results`.

## 7. Refreshing the data

```bash
export DUNE_API_KEY=...        # never commit this
bash scripts/ww-research.sh    # runs core queries -> /tmp/ww-*.json
# (optional helpers for decode / timeseries / volume were run ad hoc -> /tmp/ww-*.json)
python3 scripts/ww-gen.py      # regenerates lib/wwData.ts (stamps generatedAt)
npm run build                  # verify
```

For the live treasury balance, re-run Dune query `7717935` (manually or via the
cron) so its cached results update; the app reads them no-store.

## 8. Environment, deploy, security

- Env (`.env.local`, gitignored; also set in Vercel Production): `DUNE_API_KEY`
  (server-only, no `NEXT_PUBLIC_`), `DUNE_QUERY_ID=7717935`, `DUNE_DEFAULT_WALLET`.
- Vercel project `wwtracker`. `vercel.json` pins `"framework":"nextjs"` and a
  daily cron warming `/api/balance`. Deployment Protection is disabled so the team
  can view without a Vercel login.
- Security: the Dune key never reaches the client - confirmed by grepping the
  built `.next/static` output (0 hits) and that `lib/dune.ts` is `import
  "server-only"`. `?wallet=` / `?mint=` are base58-validated before any credit is
  spent. `.env.local` and `.vercel` are gitignored.

## 9. Constraints & deferred work

Dune is a **free-tier** account (~2,500 credits/mo). Cached reads are cheap;
large Solana scans and joins are slow and can time out. Be credit-frugal.

Deferred (each needs heavier/repeated executions or RPC decode):
- Per-trader volume leaderboard - the GROUP-BY-signer join times out on free tier.
- Per-battle PnL + win rate - needs the battle PDA per tx (account decode).
- Sell-side volume (to match the both-sides 483.88 figure).
- Artist-payout tracing - artist wallets live in each on-chain Battle account
  (`artist_a_wallet` / `artist_b_wallet`); needs RPC `getProgramAccounts` decode.
- Ops-budget wallet + weekly-skim quantification.
