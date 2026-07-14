# WaveWarZ Recap Pipeline - Design

Date: 2026-07-14
Status: approved, pending implementation plan

## 1. Goal

Turn WaveWarZ battle results into draft recap posts (per-battle and weekly
rollup) for Farcaster/X. Zaal reviews and posts manually - no auto-posting.
Every number in a recap must trace to a real source file; nothing is invented.

## 2. Non-goals

- No auto-posting. Output is always a draft file for human review.
- No full audio transcription of X Spaces (no official download API for
  Spaces audio). See Phase B for what we do instead.
- No per-battle artist-payout figures - only a platform-aggregate payout
  number exists (8.66 SOL total, from wavewarz.info). Recaps must not
  fabricate a per-battle split.
- No live leaderboard-movement diffing in v1 - `lib/leaderboard.ts` is a
  single dated snapshot with no history to diff against yet.

## 3. Data sources (verified during research, 2026-07-14)

wwtracker (this repo) is the real data source - `wwbase`, `wavewarzapp`, and
`wavewarz-overlay` are thin (a brief, a mobile alert app, a static HTML file)
and contribute nothing here.

| Source | What | Freshness |
|---|---|---|
| `public/ww-battles.json` | 949 per-battle records: id, date, artists, winner, volume, margin | **Stale** - newest entry Jun 15, 2026. Fixed by Phase A's fetch step. |
| `lib/wwData.ts` | Dune on-chain snapshot: battle/trade/trader counts, treasury flow | Snapshot dated 2026-06-14, regenerate via `scripts/ww-research.sh` + `ww-gen.py` (needs `DUNE_API_KEY`) |
| `lib/battles.ts` (`BATTLE_STATS`) | Aggregate volume (484.46 SOL) + artist payouts (8.66 SOL), from wavewarz.info | Snapshot 2026-06-15 |
| `lib/leaderboard.ts` | 48-artist Main Event leaderboard (wins/vol/earn) | Snapshot 2026-06-15, Main Events only |
| `public/ww-activity.json` | Daily buys/sells/battles/claims | Same refresh path as `wwData.ts` |
| `lib/artists.ts` | Artist handle -> Audius ID roster | Manually maintained |

On-chain (Dune) and wavewarz.info numbers agree in ballpark (~484 SOL total
vs. 324.62 SOL buy-side on-chain) - no repeat of the ZAOOS doc 1075
inconsistency ($663 vs $7.76). This pipeline only ever reads from the sources
above, never from doc 1075 or similar unverified research docs.

## 4. Phase A - battle + weekly recap pipeline

### 4.1 Fetch step - fixing the staleness gap

`scripts/ww-battles-fetch.ts` (new, TypeScript, run via `tsx` - the one new
devDependency this plan adds, so recap scripts can import the existing
`lib/*.ts` data modules - `lib/leaderboard.ts`, `lib/battles.ts`,
`lib/artists.ts` - directly instead of duplicating their data. Node 20 (this
repo's runtime) can't execute `.ts` natively; `tsx` is a small, zero-config
TS runner, dev-only, not part of the deployed app):

- Vendors the parsing logic from the private `ZAOscout` repo's
  `wavewarz-battles.ts` (paginated scrape of
  `wavewarz-intelligence.vercel.app/battles`, no login required). Credited in
  a header comment. Approved for vendoring since wwtracker is public and the
  parser has no secrets or business logic worth hiding.
- Fetches pages newest-first, stops as soon as a page yields only battle_ids
  already present in `public/ww-battles.json` (no need to re-walk all 949
  battles every run).
- Merges new battles into `public/ww-battles.json` by `battle_id` (dedupe,
  preserve existing older entries untouched). The scraper's raw output also
  carries `song1Handle`/`song2Handle` (artist handles) - not present in the
  current file's schema. These are added as optional fields going forward;
  older already-merged battles simply have them as `null`. Recap prose uses
  the handle when present, falls back to song title when not (confirmed
  approach - section 4.4).
- **Fails loud**: on HTTP error or a page that doesn't parse as expected, the
  script exits non-zero and writes nothing. It never falls back to stale data
  silently - a failed refresh must look like a failure, not a quiet no-op.

### 4.2 Recap units (revised after review)

WaveWarZ runs 11 shows/week (weekday 11am EST AMA chats + weeknight 8:30pm EST
Quick Battle streams on X Spaces). Recapping every individual Quick Battle
on-chain record (886 of them, many <0.1 SOL) would flood the repo with noise.
Instead there are two recap units:

- **Show recap** (`recaps/shows/`) - one per Space/stream. Manual-trigger:
  Zaal shares the Space replay URL (no reliable no-login way to enumerate past
  Spaces automatically - X gates the Spaces list). Rolls up whatever battles
  from `public/ww-battles.json` fall on that Space's date, plus - when a
  matching speaker log exists (Phase B, section 5) - real quoted color from
  the stream.
- **Main Event recap** (`recaps/battles/`) - one per Main Event battle
  (`type: "MAIN"` - 39 battle-level records in the current snapshot, growing
  over time; not to be confused with `BATTLE_STATS.events` = 72, which
  counts *tournaments*, a coarser unit - a tournament can span several MAIN
  battles). Quick Battles (`type: "QUICK"`) never get a standalone file -
  they only appear inside show recaps and the weekly rollup.

  **Classification correction (found while planning implementation):** the
  live `/battles` feed has no `type`/`category`/`battleType` field at all -
  confirmed against the raw scraped JSON, not just the existing snapshot.
  `marginPct` only reliably identifies Quick Battles: every QUICK record has
  a numeric margin, verified with 0 exceptions across all 949 current
  records. But `margin: null` is **not** unique to MAIN - the 24
  `COMMUNITY`-type records are also `margin: null`. So a newly scraped
  battle can be auto-tagged `QUICK` when margin is present, but a null-margin
  battle cannot be safely auto-tagged MAIN vs COMMUNITY - that distinction
  doesn't exist in the feed and depends on which battles Zaal knows are
  tournament headliners.

  Resolution: the fetch step tags new null-margin battles `UNCLASSIFIED`
  rather than guessing. Main Event recaps are **manually triggered** -
  `scripts/ww-recap.ts --battle <id> --type main-event` - Zaal points at a
  specific `battle_id` he knows is a Main Event (matches his stated
  preference to share links/point at things directly rather than trust an
  automatic guess here). The script fails loud if that id isn't in
  `ww-battles.json` or doesn't exist.

### 4.3 Cursor state

`recaps/STATE.json`:

```json
{
  "recappedBattleIds": [1781140240],
  "lastWeeklyRecapEnd": "2026-07-07",
  "recappedShowDates": ["2026-07-12", "2026-07-13"]
}
```

Battle IDs are timestamp-derived and increase monotonically with time (newest
battle = highest id, verified against all 949 current records - zero
violations) - useful for weekly-window math, but Main Event recaps are
manually triggered (section 4.2 classification correction), so there's no
"auto cursor" for them - `recappedBattleIds` just makes re-running the same
`--battle <id>` a no-op instead of a duplicate file, unless `--force` is
passed. `recappedShowDates` does the same for show recaps.

### 4.4 Recap generator

`scripts/ww-recap.ts [--battle <id> --type main-event | --show <space-url> [--date <YYYY-MM-DD>] | --weekly]`

- **`--battle <id> --type main-event`**: Zaal points at a specific
  `battle_id` he knows is a Main Event. Fails loud if the id isn't in
  `ww-battles.json`. No-ops (not a duplicate file) if already in
  `recappedBattleIds`, unless `--force`.
- **`--show <space-url>`**: the primary manual path for the 11 weekly
  shows. Optionally pass `--date` if the battle date doesn't match the
  Space's actual air date; otherwise inferred from the Space. Triggers
  Phase B's speaker-log capture (section 5) for that URL, pulls that date's
  battles from `ww-battles.json`, writes one show recap. Idempotent per
  date via `recappedShowDates`.
- **`--weekly`**: aggregates every battle (Main + Quick + Community) in the
  trailing 7 days (or since `lastWeeklyRecapEnd`, defaulting to 7 days back
  on first run) into one rollup file; cursor advances.

`scripts/recap/format.ts` - pure functions, unit-testable in isolation:

- `buildShowRecap(showDate, battlesThatDate[], speakerLog?, context)` ->
  `{ farcaster, x, prose, sources[] }`
- `buildMainEventRecap(battle, context)` -> same shape
- `buildWeeklyRecap(battles[], context)` -> same shape
- `context` pulls in supporting data only where it genuinely exists: the
  artist's current leaderboard rank/record if they're in `lib/leaderboard.ts`,
  that day's platform activity from `public/ww-activity.json`. Anything not
  present (per-battle payout, leaderboard movement) is omitted, not
  approximated.
- Every draft ends with a fixed tag/link line: `@WaveWarZ - wavewarz.com`
  (Zaal's call for now, adjustable later).

### 4.5 Output format

`recaps/shows/YYYY-MM-DD-show.md` and `recaps/battles/YYYY-MM-DD-<battle_id>-<slug>.md`
share the same shape:

```markdown
# <Show Recap | Main Event Recap> - <title> - <date>

## Draft - Farcaster
<prose draft, ZAO voice, no emojis, no em dashes, ends with "@WaveWarZ - wavewarz.com">

## Draft - X
<compressed draft, fits a single post, same tag line>

## Data used
- Winner: <name> (source: public/ww-battles.json, battle_id <id>)
- Volume: <x> SOL (source: same)
- Margin: <x%> - SOL-pool share, Charts-only rule (Quick Battles only; source: same)
- Artist standing: <rank/record> (source: lib/leaderboard.ts, snapshot date)
- Stream quote/moment: <text> (source: recaps/spaces/<space-id>-speakerlog.json, MM:SS) - show recaps only, only if a log exists

## Not included (unverifiable at this granularity)
- Per-battle artist payout: only the platform-aggregate figure exists (8.66 SOL total)
- Notable individual trades: no per-battle trade-level data available
```

`recaps/weekly/YYYY-Www.md` - same two draft sections, but "data used" rolls
up: battle count (Main + Quick), total volume, top-volume battle,
closest-margin battle, most-active artist by battle count, platform totals
for the week (from `ww-activity.json`), plus links to that week's show and
Main Event recap files.

### 4.6 Testing (vitest, matches existing `lib/__tests__` pattern)

- Scraper parser: fixture HTML page -> expected battle objects.
- Recap formatting: fixture battle -> assert no NaN/undefined, sources[]
  populated, omitted fields actually omitted (not zeroed).
- Cursor logic: given battles + old state -> correct new state.

## 5. Phase B - X Spaces speaker log

WaveWarZ streams Quick Battles/AMAs on X Spaces. There's no official API to
download Spaces audio, so this does not attempt transcription. Instead:

- Input: a Spaces replay URL Zaal shares (manual hand-off, matches his
  request for the initial runs).
- Process: an agent drives the browser (claude-in-chrome) to the replay,
  seeks through it at fixed intervals (e.g. every 60s), screenshots the
  player each time, and reads off:
  - whoever X's UI highlights as the active speaker (ring around their
    avatar + name label)
  - any on-screen live captions X already rendered for that Space, if
    present
- Output: `recaps/spaces/<space-id>-speakerlog.json` -
  `[{ timestampSec, speaker, captionText? }]`
- The recap generator (4.3) can pull from a matching speaker log, when one
  exists for a battle's date, to attribute a real quote or color line in the
  prose draft - always cited as "per space replay at MM:SS", never
  paraphrased into something the log didn't actually show.

Constraints, stated plainly (not glossed over):

- Requires an X account logged into the Chrome profile Claude automates -
  Spaces replays can require auth.
- This produces visually-confirmed speaker identity + timing, not full
  audio transcription. Without on-screen captions for a given Space, we get
  "who was talking when," not their exact words - the recap must not invent
  dialogue.
- This is an agent-driven session kicked off with a URL, not an unattended
  cron job - screenshot+vision per interval has real per-run cost. Use it
  selectively (Main Events, notable Spaces), not every nightly Quick Battle.

## 6. Constraints carried through from the task

- PR-only. Nothing in this pipeline pushes to main or auto-posts anywhere.
- Recaps are drafts. Zaal posts manually.
- No invented numbers. Anything not traceable to a source file is omitted
  and called out in "Not included," never approximated or guessed.
- Secrets (`DUNE_API_KEY` if the on-chain snapshot is refreshed as part of
  this work) stay in `.env.local`, never committed.
