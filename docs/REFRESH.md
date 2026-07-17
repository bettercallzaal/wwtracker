# Refreshing wwtracker data

Most of the app is **baked snapshots** (they don't auto-update). This is the
runbook to re-pull them. Live data (treasury balance, Audius, YouTube) needs no
refresh. After any refresh: bump `DATA_AS_OF` in `lib/freshness.ts`, run
`npm run validate`, then `npm run build` and deploy.

## What's snapshot vs live

| Data | Source | File | Live? |
|------|--------|------|-------|
| Treasury balance + intraday high | Dune query 7717935 (cached read) | - | live |
| Battle aggregate stats | wavewarz.info/api/public/stats | lib/battles.ts | snapshot - refresh with curl, see § A below |
| Songs (37) | wavewarz.info/leaderboards/songs | lib/songs.ts | snapshot |
| Artist leaderboard (48) | .../leaderboards/artists | lib/leaderboard.ts | snapshot |
| Trader leaderboard (101) | .../leaderboards/traders | lib/traders.ts | snapshot |
| Battles | wavewarz-intelligence.vercel.app/battles?page=N | public/ww-battles.json | snapshot - `npm run fetch:battles` automates this now, see below |
| Skips / queue per night | Dune (FNj inflows) | public/ww-skips.json, ww-queue.json | snapshot |
| On-chain analytics | Dune | lib/wwData.ts | snapshot |
| SOL/USD reference price | CoinGecko simple price | lib/price.ts | snapshot - update `SOL_USD` + `SOL_USD_AS_OF` manually |
| Artists / Music / per-artist | Audius API | - | live |
| YouTube | oEmbed + channel | components/Events.tsx | snapshot ids |

## A. Refresh BATTLE_STATS (lib/battles.ts)

The aggregate counts (total battles, quick/main/community split, volume, artist
payouts, trader claims) come from the wavewarz.info public API — no auth needed.

```bash
curl -s https://wavewarz.info/api/public/stats | python3 -m json.tool
```

Copy the response values into `lib/battles.ts`:

| Response field | BATTLE_STATS key |
|---|---|
| `battles.mainEvents` | `events` |
| `battles.quickBattles` | `quickBattles` |
| `battles.mainBattles` | `multiRound` |
| `battles.communityBattles` | `communityBattles` |
| `battles.total` | `totalShown` |
| `volume.totalSol` | `totalVolumeSol` |
| `artistPayouts.totalSol` | `artistPayoutsSol` |
| `platformRevenue.totalSol` | `platformRevenueSol` |
| `traderClaims.totalSol` | `traderClaimsSol` |
| `traderClaims.withdrawalCount` | `withdrawalCount` |

Also update the `RECENT_BATTLES` array with the 2 most recent MAIN and 2 most
recent QUICK battles (from `public/ww-battles.json` after running
`npm run fetch:battles`). After updating, bump `DATA_AS_OF` in
`lib/freshness.ts` and run `npm run validate`.

## B. Scrape wavewarz.info (songs / leaderboards)

**Battles no longer need this** - run `npm run fetch:battles` instead. It
pages `wavewarz-intelligence.vercel.app/battles` directly (no browser
needed), merges only new battles into `public/ww-battles.json`, and fails
loud (throws, writes nothing) on any HTTP/parse error rather than risking a
stale or partial write. See `docs/superpowers/specs/2026-07-14-recap-pipeline-design.md`
for the full design. The manual scrape below is still how songs/leaderboards
get refreshed.

The site renders client-side, so use the gstack browse skill. KEY RULE: the
flattened page text bleeds between rows - read **per cell** via `$B eval` JS that
maps each `<td>.innerText` (table pages).

```bash
B=~/.claude/skills/gstack/browse/dist/browse
# leaderboards (tables): goto the page, wait, eval a td-per-cell extractor -> JSON
$B goto "https://wavewarz.info/leaderboards/traders"; $B wait --networkidle; sleep 1
$B eval /tmp/extract-traders.js   # querySelectorAll('tr') -> TD innerText; full wallets from row hrefs /trader/{addr}
$B stop
```

Parse each result with the regex parsers used before (winner-anchored matchup
split for battles; per-cell for tables) and regenerate the `lib/*.ts` /
`public/*.json` snapshots. Then `npm run validate`.

## C. Dune (treasury balance, skips, queue)

Free-tier has a monthly datapoint cap (big Solana scans exhaust it). Keep queries
**bounded to one wallet** (FNj) - they cost ~0.0025 credits. If the cap is hit,
make a fresh free account (the private-query cap means create **public** queries;
reuse one public query via PATCH).

```sql
-- skip ladder (0.02 + 0.01 per concurrent skip) per night
SELECT block_date, count(*) AS skips, round(sum(balance_change)/1e9,4) AS skip_sol
FROM solana.account_activity
WHERE address='FNjYtw...kq37' AND balance_change>0
  AND round(balance_change/1e9,2) IN (0.02,0.03,0.04,0.05,0.06,0.07,0.08,0.09,0.10,0.11,0.12)
GROUP BY 1 ORDER BY 1 DESC;

-- queue + DJ Wavy (same 0.005 price; can't be split on-chain)
SELECT block_date, count(*) AS queue
FROM solana.account_activity
WHERE address='FNjYtw...kq37' AND balance_change>0 AND round(balance_change/1e9,3)=0.005
GROUP BY 1 ORDER BY 1 DESC;
```

Treasury balance (query 7717935) is read cached and refreshes when the saved
query is re-run on Dune. The on-chain analytics snapshot is regenerated via
`scripts/ww-research.sh` then `scripts/ww-gen.py` (writes lib/wwData.ts).

## B2. Dune via REST API (daily activity + volume board)

Reusable public query **7728208** ("ww-fnj-hist"): PATCH its `query_sql`, POST
`/execute` (NO `performance` field - free tier rejects `medium`), poll
`/execution/{id}/status`, GET `/query/7728208/results`. Key in `.env.local`
(`DUNE_API_KEY`). Free tier = HARD 2-minute execution timeout.

```sql
-- daily program activity -> public/ww-activity.json (53 days)
-- disc map (to_hex is UPPERCASE): buy 28EF8A9A sell B8A4A910 initBattle 756CA69F
--   endBattle 5091D030 claim 82831DED initMints BD54558E
SELECT block_date, to_hex(bytearray_substring(data,1,8)) AS disc, count(*) AS n
FROM solana.instruction_calls
WHERE executing_account='9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'
  AND block_date >= current_date - interval '60' day
GROUP BY 1,2 ORDER BY 1 DESC;

-- per-trader SOL volume, 30d -> public/ww-volboard.json
-- STEP 1 (cheap, no join): get the active trader address list
SELECT tx_signer AS trader, count(*) AS buys
FROM solana.instruction_calls
WHERE executing_account='9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'
  AND lower(to_hex(bytearray_substring(data,1,8)))='28ef8a9a08256a6c'
  AND block_date >= current_date - interval '30' day
GROUP BY 1 ORDER BY 2 DESC LIMIT 60;
-- STEP 2: join account_activity, FILTERED to that address list on BOTH sides
--   (the unfiltered join over all signers times out at 2 min - this is the trick)
SELECT ic.tx_signer AS trader, round(-sum(aa.balance_change)/1e9,3) AS sol_volume,
       count(distinct ic.tx_id) AS buys
FROM solana.instruction_calls ic
JOIN solana.account_activity aa
  ON aa.tx_id=ic.tx_id AND aa.address=ic.tx_signer AND aa.balance_change<0
  AND aa.block_date >= current_date - interval '30' day
  AND aa.address IN ( <addrs from step 1> )
WHERE ic.executing_account='9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo'
  AND lower(to_hex(bytearray_substring(ic.data,1,8)))='28ef8a9a08256a6c'
  AND ic.block_date >= current_date - interval '30' day
  AND ic.tx_signer IN ( <addrs from step 1> )
GROUP BY 1 ORDER BY 2 DESC LIMIT 60;
```

Skip calibration: skips = FNj inflows `0.015 <= amt <= 1.0` (the 0.0157 bucket is
a fee-trimmed 0.02 skip); queue = `amt == 0.005`. Verified vs 2026-06-13 (20 skips
/ 1.1667 SOL, queue 11). Both `public/ww-skips.json` + `ww-queue.json` are
date-keyed maps; merge new days into the existing history, newest-first.

## D. Finish

```bash
# update lib/freshness.ts DATA_AS_OF, then:
npm run validate && npm run build && vercel --prod --yes
```
