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

## C. Finish

```bash
# update lib/freshness.ts DATA_AS_OF, then:
npm run validate && npm run build && vercel --prod --yes
```
