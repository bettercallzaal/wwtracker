# What is in scripts/, and when you would run it

Twenty-seven scripts, and until 2026-09-23 no index of them anywhere. That is
not a tidiness problem. **Two of the three tools a battle night depends on were
broken for days** - a dropped command-line flag and a time window that could not
reach the previous evening - because they run once a week and nothing else
exercises them, and because the procedure that uses them did not name them.
`docs/SOP.md` names them now; this says what everything else is for.

Descriptions are each script's own first line of documentation. Where a script
has never been run in full, it says so.

## A battle night

| Script | What it does |
|---|---|
| `ww-night.sh` | Battle night in one command: `rehearse`, `ready`, `start`, `status`, `stop`. **Run `rehearse` first** - it exercises the marker and the report instead of only checking that processes are up |
| `ww-live-watch.ts` | The watcher. Reads live battles every 3 s, checks our curve against every real trade, and appends samples to `var/ww-live/<id>.jsonl` |
| `ww-mark.sh` | The marker terminal. Type `announce` when the host opens the round, `sent` when a wallet confirms |
| `ww-45s-report.ts` | After the night: the announcement lag per battle, from the marks |
| `ww-night-record.ts` | After the night: everything else the samples show - coverage, observed pool moves, the largest increase, the final minute, settled state |

## Settling and claiming

| Script | What it does |
|---|---|
| `ww-settle-dry-run.ts` | Packs every unsettled battle into transactions and simulates each one. No wallet, no flag, nothing signed |
| `ww-verify-battle.ts` | Replays one battle from chain and checks our model against the program's own numbers |
| `ww-pool-backfill.ts` | Rebuilds a battle's pool history from its own transactions, for a battle the watcher missed |

## Asking the chain a question

| Script | What it does |
|---|---|
| `ww-doctor.ts` | One command that says whether everything we rely on is working right now |
| `ww-explain.ts` | Why did that fail? Decodes a signature, an error code, or a raw RPC error |
| `ww-trade-helper.ts` | What you actually get for a given spend, before you click |
| `ww-battle-decode.ts` | Decodes one battle account |
| `ww-sdk-walkthrough.ts` | The whole loop using only what `lib/ww` exports - the portability check with a pulse |

## Data that ships with the site

| Script | What it does |
|---|---|
| `ww-research.sh`, `ww-gen.mjs` | Regenerate the analytics snapshot in `lib/wwData.ts` |
| `ww-battles-fetch.ts` | Rebuilds `public/ww-battles.json` from WaveWarZ's public API |
| `ww-treasury-backfill.ts` | Extends `public/ww-daily-treasury.csv` from chain. **Never run in full**: reaching the 2026-07-22 gap takes ~3,100 RPC calls, about twenty minutes against the endpoint the watcher shares. Proven on a two-day window, where its walk ended exactly on the chain's balance. Run it with `--from` on a keyed endpoint |
| `capture-ww-fixtures.ts` | Re-captures the transaction fixtures from chain, or checks they still match |
| `validate.mjs` | Pre-build check that no snapshot is stale or empty |

## Writing and review

| Script | What it does |
|---|---|
| `check.mjs` | Every gate, and never loses the reason one failed. This is `npm run check` |
| `check-pr-review.mjs` | The standing PR gate for the security and database reviewers |
| `ww-recap.ts` | Recap markdown drafts |
| `ww-speaker-log.ts` | Resolves a diarized transcript's `speaker_N` labels to real names |
| `ww-indexer-report.ts` | PRD 34 scored against wavewarz.info's public API |
| `smoke-stats-api.ts` | Checks the upstream stats endpoint is up and shaped as expected |

## Not currently used

| Script | Why it is here |
|---|---|
| `install-live-watch.sh` | Installs the watcher under launchd, writing to `~/.zao/logs/`. **That arrangement is not what runs today** - `ww-night.sh` does, logging to `var/ww-live-watch.log`. A monitor was still watching the launchd path on 2026-09-22 and reading a file frozen since 18:48 the previous day, which reports steady state for ever |
| `live-watch.mjs` | Watches the `/live` page through a final, unattended. Built for the Grand Final; the page monitor, not the chain watcher |
