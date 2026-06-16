# Refreshing wwtracker data

Most of the app is **baked snapshots** (they don't auto-update). This is the
runbook to re-pull them. Live data (treasury balance, Audius, YouTube) needs no
refresh. After any refresh: bump `DATA_AS_OF` in `lib/freshness.ts`, run
`npm run validate`, then `npm run build` and deploy.

## What's snapshot vs live

| Data | Source | File | Live? |
|------|--------|------|-------|
| Treasury balance + intraday high | Dune query 7717935 (cached read) | - | live |
| Songs (37) | wavewarz.info/leaderboards/songs | lib/songs.ts | snapshot |
| Artist leaderboard (48) | .../leaderboards/artists | lib/leaderboard.ts | snapshot |
| Trader leaderboard (101) | .../leaderboards/traders | lib/traders.ts | snapshot |
| Battles (949) | .../battles?page=N | public/ww-battles.json | snapshot |
| Skips / queue per night | Dune (FNj inflows) | public/ww-skips.json, ww-queue.json | snapshot |
| On-chain analytics | Dune | lib/wwData.ts | snapshot |
| Artists / Music / per-artist | Audius API | - | live |
| YouTube | oEmbed + channel | components/Events.tsx | snapshot ids |

## A. Scrape wavewarz.info (songs / leaderboards / battles)

The site renders client-side, so use the gstack browse skill. KEY RULE: the
flattened page text bleeds between rows - read **per cell** via `$B eval` JS that
maps each `<td>.innerText` (table pages) or per-card text (battles).

```bash
B=~/.claude/skills/gstack/browse/dist/browse
# leaderboards (tables): goto the page, wait, eval a td-per-cell extractor -> JSON
$B goto "https://wavewarz.info/leaderboards/traders"; $B wait --networkidle; sleep 1
$B eval /tmp/extract-traders.js   # querySelectorAll('tr') -> TD innerText; full wallets from row hrefs /trader/{addr}
# battles: paginated via ?page=N (NOT infinite scroll). Loop 1..~48 until first id repeats.
for p in $(seq 1 55); do $B goto "https://wavewarz.info/battles?page=$p"; $B wait --networkidle; sleep 0.7; $B eval /tmp/card-extract.js >> /tmp/ww-battles-raw.jsonl; done
$B stop
```

Parse each result with the regex parsers used before (winner-anchored matchup
split for battles; per-cell for tables) and regenerate the `lib/*.ts` /
`public/*.json` snapshots. Then `npm run validate`.

## B. Dune (treasury balance, skips, queue)

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

## C. Finish

```bash
# update lib/freshness.ts DATA_AS_OF, then:
npm run validate && npm run build && vercel --prod --yes
```
