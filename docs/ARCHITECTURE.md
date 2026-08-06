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
  AppShell.tsx          renders the 11 numbered sections (see §4) as one scrolling
                        page with sticky jump-nav; legacy ?tab= deep links still work
  AboutWaveWarZ.tsx / HowItWorks.tsx    what it is, mechanics, fees, snapshot, addresses, team, links
  BalanceDashboard.tsx  the treasury floor: close bars + intraday-high line vs 3.5 floor
  PlatformGrowth.tsx    cumulative SOL volume timeline
  Profitability.tsx     floor model + distribution split
  OpsLedger.tsx         real-world costs/income: tech stack, monthly P&L, fee wallet (lib/opsLedger.ts)
  PlatformAnalytics.tsx decoded instruction mix, timeline, activity, treasury flow, volume, leaderboard
  Battles.tsx           full battle history: search/filter/CSV export
  Leaderboard.tsx / Traders.tsx / TraderScorecard.tsx   artist leaderboard, trader table, wallet PnL lookup
  Songs.tsx / Artists.tsx / Music.tsx   song charts + artist roster, Audius-backed
  Ecosystem.tsx / Events.tsx / Faq.tsx  ecosystem context, events, FAQ
lib/
  dune.ts               server-only Dune client (live reads + execute path)
  solana.ts             base58 address validation
  theme.ts              shared palette + label style - every component should import
                        `{ C, metaLabel }` from here, never redefine its own copy
  config.ts             single source of truth for PROGRAM_ID / TREASURY_WALLET /
                        TRACKED_TRADER_WALLET - import these, don't hardcode addresses
  wwData.ts             GENERATED on-chain analytics snapshot (do not hand-edit)
  sampleData.ts         deterministic fallback balance series
  traderSample.ts       deterministic fallback PnL curve
public/
  ww-battles.json           per-battle records (id/type/date/artists/winner/vol/margin) - Battles.tsx
  ww-activity.json          daily buys/sells/battles/settled/claims - PlatformAnalytics.tsx
  ww-volboard.json          30d buy-side SOL volume per trader - PlatformAnalytics.tsx
  ww-platform-volume.json   daily buy/sell volume timeseries - PlatformGrowth.tsx
  ww-lifetime.json          lifetime volume snapshot (approx, sourced) - OnChainProof.tsx
  ww-queue.json / ww-skips.json / ww-wavysplit.json   per-night queue/skip/DJ-Wavy counts - Battles.tsx
scripts/
  ww-research.sh        run the core Dune queries -> /tmp/ww-*.json (needs DUNE_API_KEY)
  ww-gen.py             read /tmp/ww-*.json -> regenerate lib/wwData.ts
  validate.mjs          prebuild sanity checks on the snapshots above (run via `npm run validate`)
  recap/                the recap pipeline's internals (parser, merge, state, format) - see §7
  ww-battles-fetch.ts   refreshes public/ww-battles.json from the live feed (`npm run fetch:battles`)
  ww-recap.ts           generates recap drafts (`npm run recap`) - see §7
recaps/                 generated recap drafts (gitignored content aside from .gitkeep + STATE.json)
docs/
  WAVEWARZ-RESEARCH.md  domain research (program model, fees, team, findings)
  ARCHITECTURE.md       this file
  REFRESH.md            runbook for refreshing every snapshot
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

## 4. The sections

Not tabs - `AppShell.tsx` renders one scrolling page, numbered 00-10, with a
sticky jump-nav. Old `?tab=` deep links still resolve (mapped in
`AppShell.tsx`'s `LEGACY_TAB` table) since that's how the app used to work.

| # | Section | Component(s) | Shows | Source |
|---|---------|--------------|-------|--------|
| 00 | Overview | OnChainProof.tsx | Master chart overlaying volume/treasury/battles/trades (each indexed to its own peak) + stat tiles | WW |
| 01 | What | AboutWaveWarZ.tsx, HowItWorks.tsx | What WaveWarZ is, battle flow, fee table, live snapshot, addresses, team, ecosystem, links | WW + static |
| 02 | Floor | BalanceDashboard.tsx | Treasury daily close (bars) + intraday high (line) vs 3.5 floor; Day/Week; ATH/30d/days tiles | live /api/balance |
| 03 | Growth | PlatformGrowth.tsx | Cumulative SOL volume timeline since launch | public/ww-platform-volume.json |
| 04 | Profitability | Profitability.tsx | Floor model, 33/22/22/22 distribution split, recipient cards, distribution history (TBD until real data) | lib/distributions.ts |
| 05 | Running the business | OpsLedger.tsx | Fee wallet live SOL/WARZ balance, historical treasury snapshots, tech-stack cost table, monthly expense/income P&L (team-reported, unreconciled figures flagged) | lib/opsLedger.ts + live Solana RPC |
| 06 | Analytics | PlatformAnalytics.tsx | Decoded battles/trades/claims/traders, battles-vs-trades timeline, daily activity, treasury flow, buy-volume chart, tx-count leaderboard | WW + public/ww-activity.json, ww-volboard.json |
| 07 | Battles | Battles.tsx | Full battle history, search/filter/CSV export | public/ww-battles.json + ww-queue/skips/wavysplit.json |
| 08 | Traders | Leaderboard.tsx, Traders.tsx, TraderScorecard.tsx | Artist leaderboard, full trader table, per-wallet PnL lookup | lib/leaderboard.ts, lib/traders.ts, WW |
| 09 | Music | Songs.tsx, Artists.tsx, Music.tsx | Song charts + artist roster, Audius play counts and inline play | lib/songs.ts, lib/artists.ts + live Audius API |
| 10 | Ecosystem | Ecosystem.tsx, Events.tsx, Faq.tsx | ZAO ecosystem context, events, FAQ | static |

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
  claims, 122 unique traders (Dune snapshot 2026-06-14; see `lib/wwData.ts.generatedAt`).
- **Trader PnL (flow-based)** - for every WaveWarZ tx the wallet signs, take its
  `balance_change` on `account_activity`. Cumulative sum = realized net SOL
  (-2.96). Win rate = share of positive-delta txs (35.7%). Independent of the
  bonding-curve math; differs from the stats app's per-battle realized figure.
- **Platform buy volume** - join `account_activity` (signer's negative delta) to
  the set of `buyShares` txs by `tx_id`+`tx_signer`. Sum = SOL committed on buys
  (324.62; includes ~1.5% fees + gas). Buy-side only; the app reports 878.88 SOL
  both-sides (wavewarz.info live, 2026-07-29; was 483.88 at 2026-06-14 Dune snapshot).
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

## 6.5. Daily treasury records (`public/ww-daily-treasury.csv`)

The team's own day-by-day fee-wallet tracker, cleaned up, cross-checked, and
backfilled all the way back to the wallet's earliest on-chain activity. Not
wired into the UI yet - this is the team's internal record, kept in the repo
because it's real ground truth worth version-controlling. Covers
**2025-07-01 through today**, 386 rows.

Columns: `date, day, balance_sol, delta_sol, battles_launched,
battles_launched_onchain, notes, source`.

- **`battles_launched`** is the team's own reported count where they gave one
  (manual period only); **`battles_launched_onchain`** is independent, derived
  directly from every real Battle account on-chain (see below) - a cross-check,
  not a silent replacement. The two mostly agree closely but not exactly (e.g.
  2026-02-09: 5 and 5; 2026-03-13: manual 13 vs on-chain 11) - treat small
  day-to-day drift as expected (manual tallying vs a machine-precise count),
  not a bug.
- **2026-02-09 through 2026-05-25** (`source: manual`): transcribed from the
  team's spreadsheet (`WaveWarZ_Financial_Tracker.xlsx` - Daily BattleZ tab) -
  daily SOL balance, day-over-day delta, battles launched that day, and notes.
- **2026-05-26** (`source: on-chain (corrected)`): the original spreadsheet
  showed a -3.52 SOL delta here, but that was a formula artifact (computed
  against a blank balance cell where manual tracking had lapsed), not a real
  distribution - the real "Paid Team" distribution is the 2026-05-16 entry.
  Corrected using the verified on-chain closing balance for that day.
- **2025-07-01 through 2026-02-08 and 2026-05-27 through today**
  (`source: on-chain (backfilled)`): the spreadsheet only ever covered
  2026-02-09 through 2026-05-25. Both edges backfilled by walking
  `getSignaturesForAddress` for the treasury wallet (paginated back to its
  earliest activity, ~2025-06-29), finding each UTC day's last successful
  transaction, and reading its `postBalances` entry for the wallet via
  `getTransaction` (same last-balance-of-the-day method Dune's
  `account_activity` query uses, just via public RPC directly since no Dune
  query is available in this environment). A handful of days
  had no transactions at all - those carry the prior day's balance forward,
  marked `on-chain (backfilled, no activity that day)`. `notes` stays empty
  for every backfilled row - that's the team's own commentary, not something
  on-chain. `battles_launched` for backfilled rows is filled from the
  on-chain count described below (there's no separate manual figure to
  cross-check against for these days).

**How `battles_launched_onchain` is derived:** each WaveWarZ battle is a PDA
account owned by the program (`getProgramAccounts` filtered to `dataSize:
353`, the real observed size of a Battle account - 1,404 found on-chain, vs.
1,089 in `public/ww-battles.json`'s scraped feed, confirming the feed
undercounts). Byte offset 8-16 of each account is `battle_id`, which turns
out to be a Unix timestamp of the battle's creation (confirmed by deriving
the Battle PDA for a known battle - seeds `["battle", battle_id (u64 LE)]` -
and finding its on-chain `battle_id` matches `public/ww-battles.json`'s `id`
field exactly). Bucketing all 1,404 `battle_id`s by America/New_York calendar
day (not UTC - UTC bucketing didn't reconcile with the team's manual counts,
Eastern did much better) gives a real, independent daily battle count
straight from the chain.

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

### Battles + recap drafts

`public/ww-battles.json` no longer needs the manual gstack-browse scrape in
`REFRESH.md` §A - `npm run fetch:battles` (`scripts/ww-battles-fetch.ts`)
pages the live WaveWarZ Intelligence feed itself, merges only genuinely new
battles in, and fails loud (throws, writes nothing) on any fetch/parse error
rather than risking a stale or partial write. `npm run recap` generates
Farcaster/X draft recap posts (per Main Event, per show, or a trailing-week
rollup) into `recaps/` - every number cites its source file, nothing is
invented. Full design/rationale:
`docs/superpowers/specs/2026-07-14-recap-pipeline-design.md`; command
reference in the top-level `README.md`'s "Recaps" section.

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

Dune is a **free-tier** account (~2,500 credits/mo). Confirmed ceiling: **single-table
aggregations over `instruction_calls` / `account_activity` complete fine**
(daily activity, instruction decode, timeseries, daily volume, treasury flow),
but **joins of `account_activity` to a tx-set time out** (volume-per-trader,
artist payouts, per-battle PnL all failed). Those deep analytics need either a
paid Dune tier (faster execution) or the Helius RPC + Supabase path that candy's
apps already use (`getAccountInfo`/`getProgramAccounts` on Battle PDAs). Stay
credit-frugal and prefer single-table aggregations on free tier.

Deferred (each needs heavier/repeated executions or RPC decode):
- Per-trader volume leaderboard - the GROUP-BY-signer join times out on free tier.
- Per-battle PnL + win rate - needs the battle PDA per tx (account decode).
- Sell-side volume (to match the reported both-sides total; see `lib/battles.ts` BATTLE_STATS.totalVolumeSol for current figure).
- Artist-payout tracing - artist wallets live in each on-chain Battle account
  (`artist_a_wallet` / `artist_b_wallet`); needs RPC `getProgramAccounts` decode.
- Ops-budget wallet + weekly-skim quantification.
