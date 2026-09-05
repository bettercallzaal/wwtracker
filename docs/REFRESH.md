# Refreshing wwtracker data

Most of the app is LIVE - it auto-updates via the daily cron or by reading live
APIs. Only snapshots need manual refresh. This is the runbook.

## What's live vs snapshot

| Data | Source | File | Auto-refresh? |
|------|--------|------|---|
| Treasury balance + intraday high | Dune query 7717935 (cached read) | - | Yes - daily 9 AM cron via `/api/balance?refresh=1` |
| Battle aggregate stats | wavewarz.info/api/public/stats | lib/battles.ts | Yes - routes cache the API |
| Song charts | wavewarz.info/leaderboards/songs | lib/songs.ts | Partial - component reads Audius live, battle context is cached |
| Artist leaderboard | wavewarz.info/leaderboards/artists | lib/leaderboard.ts | No - snapshot |
| Trader leaderboard | wavewarz.info/leaderboards/traders | lib/traders.ts | No - snapshot |
| Battles list | wavewarz-intelligence.vercel.app/battles | public/ww-battles.json | No - manual `npm run fetch:battles` |
| On-chain program analytics | Dune (decoded instructions, daily activity, volume) | lib/wwData.ts + public/ww-*.json | No - manual scripts/ww-research.sh + ww-gen.py |
| Fee wallet balance (live Solana RPC) | mainnet-beta | lib/opsLedger.tsx display | Yes - live on every page load |
| Per-night queue/skips | Dune (FNj inflows) | public/ww-queue.json, ww-skips.json | No - old (Jul 2), not refreshed |

The treasury chart (section 02) is the most time-sensitive. Without
`CRON_SECRET` set in Vercel Production, the cron fails and the chart goes
stale. This is the most critical operational detail in the repo.

## Refreshing the snapshots

### Battles list (public/ww-battles.json)

Pulls from the live WaveWarZ Intelligence feed and merges only genuinely new
battles:

```bash
npm run fetch:battles
```

This is now automated. Fails loud (throws, writes nothing) on any fetch/parse
error rather than risking stale or partial data. See
`docs/superpowers/specs/2026-07-14-recap-pipeline-design.md` for the full design.

### On-chain program analytics (lib/wwData.ts)

Requires `DUNE_API_KEY`. This is expensive (Solana instruction scans) so do it
only when the snapshot is noticeably stale (every 1-2 weeks):

```bash
export DUNE_API_KEY=...        # never commit this
bash scripts/ww-research.sh    # runs Dune queries -> /tmp/ww-*.json
python3 scripts/ww-gen.py      # regenerates lib/wwData.ts (stamps generatedAt)
```

Then:

```bash
npm run validate
npm run build
vercel --prod --yes
```

### Artist / trader leaderboards (lib/leaderboard.ts, lib/traders.ts)

These are pulled from wavewarz.info. The site renders client-side, so you need
a browser automation tool. Use the gstack skill (if available in this session):

```bash
# For each leaderboard: navigate, wait for render, extract per-cell
# Then parse with the regex patterns in the scripts and regenerate the lib/*.ts files
```

Since these are low-priority and wavewarz.info already renders them live, it's
OK to let them drift. The ecosystem section (11) links to their pages instead
of embedding copies.

### Per-night queue and skips (public/ww-queue.json, ww-skips.json)

These are old (Jul 2) and no longer actively refreshed. They track FNj wallet
inflows by size (skips = 0.015-1.0 SOL, queue = exactly 0.005 SOL). If you do
refresh them:

```bash
# Dune query: count inflows by amount per day, join to FNj activity
# Merge new days into the existing history (newest-first map)
```

Not critical - the battles table (section 07) displays fine without them.

### SOL/USD reference price (lib/price.ts)

One static reference price for the metadata. Update manually:

```javascript
export const SOL_USD = 180;  // update as needed
export const SOL_USD_AS_OF = "2026-09-05";
```

No component relies on this being current; it's just for the page metadata.

## Validation & deploy

After any refresh:

1. Bump `DATA_AS_OF` in `lib/freshness.ts` to today's date
2. Run validation:
   ```bash
   npm run validate          # warns if data is stale
   npm run validate -- --strict  # fails build if data > 45 days old
   ```
3. Build and deploy:
   ```bash
   npm run build
   vercel --prod --yes
   ```

The build step runs the validators before compilation, so staleness catches
before deployment.

## Production checklist

- Is `CRON_SECRET` set in Vercel Environment? If not, the treasury chart will
  freeze. Run `vercel env pull` locally to verify.
- Are the daily logs showing successful cron runs? Check Vercel Function Logs
  for `/api/balance?refresh=1` at 9 AM every day.
- Do the snapshot file timestamps match expectations (14 days = warning,
  45 days = stale)?
