# Refreshing wwtracker data

Most of the app is LIVE - it auto-updates via the daily cron or by reading live
APIs. Only snapshots need manual refresh. This is the runbook.

## What's live vs snapshot

| Data | Source | File | Auto-refresh? |
|------|--------|------|---|
| Treasury balance + intraday high | Dune query 7717935 (cached read) | - | Yes - daily 9 AM cron via `/api/balance?refresh=1` |
| Battle aggregate stats | wavewarz.info/api/public/stats | lib/battles.ts | Yes - routes cache the API |
| Song charts | wavewarz.info/leaderboards/songs | lib/songs.ts | Partial - component reads Audius live, battle context is cached |
| Artist roster (section 11) | Audius API (server-side walk, cached 30min) | /api/audius/roster | Yes - endpoint caches on server to avoid 429 rate limits |
| Artist leaderboard | wavewarz.info/leaderboards/artists | lib/leaderboard.ts | No - snapshot |
| Trader leaderboard | wavewarz.info/leaderboards/traders | lib/traders.ts | No - snapshot |
| Battles list | wavewarz-intelligence.vercel.app/battles | public/ww-battles.json | No - manual `npm run fetch:battles` |
| On-chain program analytics | Dune (decoded instructions, daily activity, volume) | lib/wwData.ts + public/ww-*.json | No - manual scripts/ww-research.sh + ww-gen.py |
| Per-night queue/skips | Dune (FNj inflows) | public/ww-queue.json, ww-skips.json | No - old (Jul 2), not refreshed |

The treasury chart (section 02) is the most time-sensitive. It refreshes from
the daily cron at 9 AM UTC, which re-runs the Dune query whenever the stored
execution is 20h+ old. That bound replaced a `CRON_SECRET` bearer gate which
failed closed - with the env var unset the cron got a 401 and the chart froze
for 64 days while every surface still called it live.

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

Previously embedded from wavewarz.info, but the site renders client-side making
scrapes fragile. More importantly: wavewarz.info already publishes these live on
their system of record. Copying them is a liability, not a feature. Section 12
(Ecosystem) links to their pages instead.

Do not refresh these. If they are stale, that is acceptable - they are kept in
the codebase for reference and backward compatibility, but no section renders
them and no visitor sees them.

### Artist roster (section 11 - handled server-side)

The 35-artist roster is now fetched server-side by `/api/audius/roster`, cached
for 30 minutes. This replaced browser-side requests that made 208 calls per
visitor (86 returning 429 rate-limit errors). No manual refresh needed - the
endpoint refreshes its cache automatically.

Why this matters: the old design made every page load on wwtracker generate
traffic spikes to Audius on behalf of all concurrent visitors. The server-side
cache collapses 208 requests per visitor into one request per 30 minutes for
the entire world. The change is operational (not visible to users) and massive
in scope (zero browser requests to api.audius.co vs hundreds per page load).

### Per-night queue and skips (public/ww-queue.json, ww-skips.json)

Still maintained, and still refreshed by hand. PR #212 extended the DJ Wavy
split to 103 nights, so treat these as live working data even though no
section renders them today - the skip-queue auction is real platform revenue
and belongs in an embed rather than in a deleted file.

Skip calibration: skips = FNj inflows `0.015 <= amt <= 1.0` (the 0.0157 bucket is
a fee-trimmed 0.02 skip); queue = `amt == 0.005`. Verified vs 2026-06-13 (20 skips
/ 1.1667 SOL, queue 11). Both `public/ww-skips.json` + `ww-queue.json` are
date-keyed maps; merge new days into the existing history, newest-first.

> **This calibration is unverified beyond one night and may be wrong.** It assumes
> skip / queue / DJ Wavy are the only paid actions that pay `FNj`. If anything else
> does, those payments are silently counted as skips or queue. Open question, not
> yet answered: `docs/issues/001-fnj-payment-bucket-classification.md`. Do not
> treat the skip figures as exact until it is closed.

**DJ Wavy split coverage.** `public/ww-wavysplit.json` classifies 103 nights
(queue 382 / DJ Wavy 31). Roughly 49 nights in **2026-02-17 .. 2026-04-28** are
still unclassified - the busy months that need 3-day windows. DJ Wavy is a
low-event metric (~31 events all-time), so finishing the gap is optional and not
worth a fresh credit cycle on its own.

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

## The morning check

One command, thirty seconds. Run it and read three fields.

```bash
curl -s https://wwtracker.vercel.app/api/balance \
  | python3 -c "import json,sys; d=json.load(sys.stdin); r=d['rows'][-1]; print('newest row:', r['block_date'], '| balance:', r['eod_sol_balance'], '| origin:', d['origin'])"
```

**newest row should be yesterday or today.** That is the whole check. If it is
more than two days behind, the daily refresh is not landing and the treasury
chart is showing a photograph.

`origin` on this call is always `cache` - it is the cheap read. To see whether
the re-run itself happened, check Vercel Function Logs for
`/api/balance?refresh=1` at 09:00 UTC: a run that executed returns
`"origin":"execute"`, one declined as too fresh returns `"origin":"cache"` with
`refresh.reason` of `fresh`.

**First run under the new policy is 2026-09-06 09:00 UTC.** The refresh is now
bounded by the age of Dune's stored execution (20h) rather than by a bearer
token, so a missing env var can no longer freeze it - but a Dune outage, an
exhausted credit balance or a broken query still can. One `fresh` is normal;
two consecutive days of `fresh` on the 09:00 run is not.

## Production checklist - CRITICAL

- **Is the cron actually executing?** A refresh that ran returns
  `"origin":"execute"`; one that was declined as too fresh returns
  `"origin":"cache"` with a `refresh.reason` of `fresh`. Two consecutive days of
  `cache` on the 9 AM run means something is wrong. `CRON_SECRET` is optional
  now, so its absence is no longer a failure mode - but a Dune outage or a
  broken query still is.
- Are the daily logs showing successful cron runs? Check Vercel Function Logs
  for `/api/balance?refresh=1` at 9 AM UTC every day.
- Do the snapshot file timestamps match expectations (14 days = warning,
  45 days = stale)?

## The Dune key

**The Dune key lives in two places.** `.env.local` locally (gitignored) *and*
the Vercel Production environment for the `wwtracker` project. Rotating it means
updating **both** - changing only `.env.local` leaves the deployed daily cron
calling Dune with a dead key.

Note the two failure modes differ. Key **unset** is handled: `/api/balance`
returns 503 `configured:false` and the client falls back to sample data. Key
**present but revoked** is not: `lib/dune.ts` throws a `DuneError` and the route
returns Dune's own status (401/402) with the message, so the dashboard shows an
error rather than sample data.
