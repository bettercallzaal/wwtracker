# wwtracker - Architecture & Build Documentation

The on-chain business layer for WaveWarZ: the treasury wallet, the operating
floor, the fee model, the business ledger, and the program decoded instruction
by instruction. Companion to [WAVEWARZ-RESEARCH.md](WAVEWARZ-RESEARCH.md)
(the WaveWarZ domain research).

- Live: https://wwtracker.vercel.app
- Repo: https://github.com/bettercallzaal/wwtracker
- Stack: Next.js 14 (App Router) + React 18 + recharts. TypeScript throughout.
  No UI framework - inline styles + shared palette from the WaveWarZ design
  system (`lib/theme.ts`).

---

## 1. Why this was built

wavewarz.info (CandyToyBox/wavewarz-intelligence) is the system of record.
It indexes Solana via Helius into Supabase, owns the canonical Battle ID,
publishes a free public API with 7 endpoints, and renders the battles table,
leaderboards, songs, and artist pages. wwtracker used to copy all of that.

Those copies drifted. On 2026-09-XX the on-chain data was audited: the baked
trader table showed the top trader down 19.02 SOL while the platform's own API
had them up 29.95 SOL, and a baked song list held 37 rows against the API's 934.

The rule now is: nothing is baked that has a live source, and nothing is
rebuilt that wavewarz.info already renders. What is left is the part no other
WaveWarZ surface has: the treasury wallet, the operating floor, the fee model,
the business ledger, and the program itself decoded straight off Solana.

## 2. Repo layout

```
app/
  layout.tsx            root layout + metadata
  page.tsx              renders <AppShell/>
  globals.css           palette vars, reduced-motion, focus, skeleton shimmer
  api/
    balance/route.ts    GET endpoint: treasury daily balance (live, server-side)
                        ?refresh=1 re-runs the Dune query (gated by CRON_SECRET)
    ww/                 cached reads of wavewarz.info public API
      stats.ts
      battles.ts
    audius/
      roster/route.ts   server-side Audius roster walk, cached 30min (see section 3.C)
components/
  AppShell.tsx          renders 13 numbered sections (00-12) as one page with
                        sticky jump-nav; legacy ?tab= deep links still work
  [13 section files]    one component per section
  BattleLifecycle.tsx   section 08 - state machine showing funnel gaps
  EmbedsSection.tsx     the gallery of embeddable charts
  embeds/               components for each widget (registry in lib/embeds.ts)
lib/
  dune.ts               server-only Dune client
  embeds.ts             widget registry: slug, title, blurb, source, form, height
  feeModel.ts           fee schedules: trade splits, settlement splits, launch fees
  theme.ts              WaveWarZ design tokens (from CandyToyBox/wavewarz-intelligence)
  config.ts             PROGRAM_ID / TREASURY_WALLET / etc
  wwData.ts             GENERATED on-chain analytics snapshot (do not hand-edit)
  sampleData.ts         fallback balance series when env unset
  battles.ts            aggregate battle counts (live from /api/ww/stats)
  songs.ts              song chart data (from wavewarz.info, cached locally)
  leaderboard.ts        artist leaderboard
  traders.ts            trader table
  distributions.ts      floor model + distribution split config
  opsLedger.ts          real-world costs/income the team tracks manually
  price.ts              SOL/USD reference
  csv.ts                export utilities
public/
  ww-battles.json           per-battle records (from live feed via npm run fetch:battles)
  ww-onchain-daily.json     daily: txs, traders, buys, sells, claims, created, settled, minted
                            468 days from 2025-05-26 (program's first day)
  ww-platform-volume.json   daily buy/sell volume timeseries
                            466 days from 2025-05-28, totalling 921.4852 SOL
  ww-activity.json          daily instruction-type mix (buys, sells, battles, settled, claims)
  ww-volboard.json          30d per-trader SOL volume leaderboard
  ww-queue.json / ww-skips.json / ww-wavysplit.json   per-night queue/skip/DJ-Wavy counts
  ww-lifetime.json          lifetime volume snapshot
scripts/
  validate.mjs          pre-build data staleness checks; warns at 14d, flags at 45d
  ww-research.sh        run Dune queries offline -> /tmp/ww-*.json (needs DUNE_API_KEY)
  ww-gen.py             read /tmp/ww-*.json -> regenerate lib/wwData.ts
  ww-battles-fetch.ts   refreshes public/ww-battles.json from live feed (npm run fetch:battles)
  ww-recap.ts           generates recap drafts (npm run recap) for battles, shows, weekly
  recap/                recap pipeline internals (parser, merge, state, format)
recaps/                 generated recap drafts (gitignored except .gitkeep + STATE.json)
docs/
  WAVEWARZ-RESEARCH.md  domain research (program model, fees, team, findings)
  ARCHITECTURE.md       this file
  REFRESH.md            runbook for refreshing data
vercel.json             daily 9 AM cron: hits /api/balance?refresh=1
next.config.mjs         CSP frame-ancestors for embeds (wavewarz.info, wavewarz.com)
```

## 3. Two data paths

The app deliberately uses two patterns, by cost and freshness:

**A. Live (treasury balance).** `app/api/balance/route.ts` calls
`lib/dune.ts:getLatestBalances()`, which reads the cached results of saved Dune
query 7717935 (no execution cost - cheap). The DUNE_API_KEY lives only in this
server route. The fetch uses `cache: "no-store"` so Vercel's persistent Data
Cache cannot pin a stale copy across deploys.

The daily cron (`vercel.json`, 9 AM) hits `/api/balance?refresh=1`, which calls
`executeSavedQuery()` instead, forcing Dune to re-run the query. This endpoint
is gated by `CRON_SECRET` - a bearer token that must be set in the Vercel
Production environment. Without it the cron returns 401, the query never re-runs,
and the treasury chart silently goes stale. This is the single most important
operational detail in the repo.

**B. Snapshots (everything else).** Heavier analytics (instruction decode,
volume, timelines, trader PnL) are computed offline:
1. `scripts/ww-research.sh` runs Dune queries -> `/tmp/ww-*.json`
2. `scripts/ww-gen.py` reads those -> regenerates `lib/wwData.ts`
3. Components import `WW` from `lib/wwData.ts` directly

This pattern is cheap: no per-view Dune cost, instant renders, zero credit
spent after build time. `WW.generatedAt` stamps the snapshot's age.

**C. Live API reads (battles, volume, artists, traders).** `/api/ww/*` routes
cache reads of wavewarz.info's public API (`wavewarz.info/api/public/stats`).
The canonical numbers live there; these routes just avoid hammering their API
with per-pageview requests from all wwtracker visitors.

**D. Server-side API walks (artists).** `app/api/audius/roster/route.ts` walks the
35-artist roster from Audius on the server, cached 30 minutes, returning one
payload with each track trimmed to eight fields the UI reads. This replaced
browser-side requests that made 208 requests per visitor with 86 returning 429.
The measured impact: zero browser requests to api.audius.co, zero 429s, same
data shape, half the latency. Same pattern as `/api/ww/*` - move the hammer
strike to the server, cache it, and let the browser make one request to its own
origin.

## 4. The 13 sections

Not tabs - `AppShell.tsx` renders one scrolling page, numbered 00-12, with a
sticky jump-nav. Old `?tab=` deep links still resolve (mapped in
`AppShell.tsx`'s `LEGACY_TAB` table).

| # | Section | Component(s) | Shows | Source |
|---|---------|--------------|-------|--------|
| 00 | Overview | OnChainProof.tsx | Master chart (volume/treasury/battles/trades, each indexed to its peak) + stat tiles | WW |
| 01 | What | AboutWaveWarZ.tsx, HowItWorks.tsx, FeeModel.tsx | What WaveWarZ is, battle flow, fee table, live snapshot, addresses, team, links | WW + static + lib/feeModel.ts |
| 02 | Floor | BalanceDashboard.tsx | Treasury daily close (bars) + intraday high (line) vs 3.5 floor; Day/Week toggle | live /api/balance |
| 03 | Growth | PlatformGrowth.tsx | Cumulative SOL volume timeline since May 2025 | public/ww-platform-volume.json |
| 04 | Economics | FeeModel.tsx | Fee schedule: 1.5% per trade (1.0% artist, 0.5% platform), settlement splits | lib/feeModel.ts |
| 05 | Profitability | Profitability.tsx | Floor model, 33/22/22/22 distribution split, recipient cards, distribution history | lib/distributions.ts |
| 06 | Revenue | WeeklyRevenueAnalytics.tsx | Weekly on-chain fee wallet inflow, the trend, per-battle fee | WW + live API |
| 07 | Operations | OpsLedger.tsx | Real-world costs/income (tech stack, monthly P&L, fee wallet balance) | lib/opsLedger.ts + live RPC |
| 08 | Program | BattleLifecycle.tsx, PlatformAnalytics.tsx | State machine funnel (create/mint/trade/settle/claim) with gap analysis + decoded instruction mix | public/ww-onchain-daily.json + WW |
| 09 | Market | TraderEdge.tsx | When money shows up, which artists pull it in, how often the crowd is right, the shape of the market | public API + WW |
| 10 | Embeds | EmbedsSection.tsx | Gallery of embeddable charts and counters | components/embeds/ |
| 11 | Artists | Artists.tsx, Music.tsx | The roster (live from Audius), who they are, releases, play totals | /api/audius/roster |
| 12 | Ecosystem | Ecosystem.tsx, Events.tsx, Faq.tsx | The ZAO, events, FAQ | static |

## 5. The fee model (lib/feeModel.ts)

Every SOL that moves on WaveWarZ follows a fixed schedule:

- **Trade fee**: 1.5% per trade, split 1.0% to artist, 0.5% to platform
  (collected from traders as they buy and sell shares)

- **Settlement split** (applied to the losing pool when a battle ends):
  - 50% back to losing traders (pro-rata to their share)
  - 40% to winning traders (pro-rata)
  - 5% to winning artist
  - 2% to losing artist
  - 3% to platform

- **Battle launch fees**:
  - Quick Battle: 0.69 SOL
  - Community Battle: 4.0 SOL
  - Main Event: free (staff-run)

- **Skip-queue auction**: first skip costs 0.02 SOL, each successive skip costs
  0.01 more (0.03, 0.04, 0.05... up to approximately 0.12 before the queue resets)

These figures are declared in `lib/feeModel.ts` and exported as utility functions
(`tradeFeeSplit()`, `settlementSplit()`, `skipAuctionCost()`, etc). The fee table
in section 01 (HowItWorks.tsx) renders them. Use this library, never hardcode fees.

Reference: CandyToyBox/wavewarz-intelligence CLAUDE.md and public/llms.txt.

## 6. The design system (lib/theme.ts)

The entire palette comes verbatim from docs/DESIGN-SYSTEM.md v1.0 in the
CandyToyBox/wavewarz-intelligence repo:

- Void, bg, panel, elev - surface hierarchy
- Accent (lime 95fe7c) - primary action and success
- Blue - secondary/info
- Text, dim - typography
- Danger (red ef4444) - only for sell actions, losses, the floor line (never positive things)
- Zero purple, in any shade

Fonts are loaded in `app/layout.tsx`:
- **Rajdhani** (600, 700 weight): the arena voice for scoreboard headlines
- **Inter**: body text for sentences
- **JetBrains Mono**: data labels and system state (the signal that a number is real)

Every component imports `{ C, metaLabel }` from `lib/theme.ts`, never defines
its own copy. When wwtracker embeds live on wavewarz.info, a shared palette
means the widget reads as part of the site, not a third-party bolt-on.

## 7. Embeds (lib/embeds.ts + components/embeds/)

Every chart and counter on wwtracker can be embedded elsewhere as a standalone
iframe: `/embed/<slug>`. The registry in `lib/embeds.ts` declares 17 widgets,
weighted toward on-chain data nobody else has:

```typescript
{
  slug: "treasury-daily",
  title: "Treasury Daily Balance",
  blurb: "The platform wallet vs the 3.5 SOL operating floor",
  category: "Treasury",
  source: "onchain",        // Dune - treasury wallet, program activity
  form: "area",
  height: 320,
  suggestedHost: "wavewarz.info",
  exclusive: true,          // only wwtracker has this
}
```

Sources are:
- `onchain` - Dune query results over the Solana program or treasury wallet.
  Nobody else has this data.
- `platform` - wavewarz.info public API (same numbers they already show).
- `snapshot` - public/*.json files, rebuilt from one of the above.

Forms are: counter, line, area, bar, pie, table.

The gallery (section 10) shows every widget live. Framing is CSP-restricted in
`next.config.mjs`: only wavewarz.info, wavewarz.com, and Vercel preview builds
can embed our widgets.

### Adding a new embed widget

To add a new chart or counter as an embeddable widget:

1. **Register in `lib/embeds.ts`** - add one entry to the `EMBEDS` array with
   slug, title, blurb, category, source, form, height, and suggestedHost.

2. **Build the component in `components/embeds/`** - create one `.tsx` file
   matching the slug. The component receives no props and handles its own data
   fetch. Import from the same sources (Dune results in `lib/wwData.ts`,
   snapshot files at `/api/ww/*` or public/*.json, or live RPC).

3. **Register in `components/embeds/Widgets.tsx`** - add the slug-to-component
   mapping in the `WIDGETS` map. The embed route (`app/embed/[slug]/route.tsx`)
   uses this map to render the right component.

4. **Test** - visit `/embed/<slug>` directly, then embed in a test page:
   ```html
   <iframe
     src="https://wwtracker.vercel.app/embed/your-slug"
     style="width: 100%; height: 320px; border: none;"
   />
   ```

Why embeds matter: sections 10 is the gallery where embed browsers find new
widgets. If a chart belongs in the registry but is not yet in section 10, the
route still works and the chart stays embeddable - it is just undiscoverable.

## 8. Program decoding & instruction mapping

The on-chain analytics snapshot includes every call to the WaveWarZ program
since its first day (2025-05-26), decoded by Anchor discriminator:

- **buyShares**: 28ef8a9a08256a6c (count: 9,646)
- **sellShares**: b8a4a91061be9410 (count: 3,409)
- **initBattle**: 756ca69f7868abeb (count: 1,643)
- **endBattle**: 5091d030ee2adc5e (count: 1,602)
- **claimShares**: 82831ded3b1c4f3a (count: 2,762)
- **initMints**: bd54558e87f81f77 (count: 1,604)

How these six discriminators were mapped: each unknown hex was correlated against
a known snapshot by daily counts. All 53 unique instruction types in the snapshot
matched exactly to 53 known discriminators with no collisions - a wall of day-by-day
agreement that would be astronomically unlikely by chance. This one-to-one mapping
is documented here to show the work: if these discriminators ever change or the
Anchor program recompiles, the counts will diverge sharply and that divergence is
your signal to re-derive the mapping.

Counts as of 2026-09-05 (last snapshot). The snapshot covers:
- Total transactions: 20,677
- Unique traders: 145
- Battles created / settled / minted: 1,643 / 1,602 / 1,604
- Buys / sells / claims: 9,646 / 3,409 / 2,762
- Total volume: 921.4852 SOL (confirmed against reported 921.29 SOL)

`public/ww-onchain-daily.json` has 468 rows of daily activity from 2025-05-26
to today. `public/ww-platform-volume.json` has 466 rows of cumulative volume
from 2025-05-28 onward.

## 9. Battle lifecycle & funnel analysis (components/BattleLifecycle.tsx)

Section 08 presents the program as a state machine, not six unrelated counters.
Every battle walks the same path: createBattle (initBattle), mint (initMints),
trading window (buyShares and sellShares), settlement (endBattle), claims
(claimShares). BattleLifecycle.tsx renders these stages as a funnel, with the
GAPS between stages as the focus - battles created but never minted, minted
battles with no trades, settled battles whose winnings nobody claims.

As of 2026-09-05:
- 1,643 battles created
- 1,604 minted (39 created but never minted)
- 13,055 trades total (9,646 buys + 3,409 sells)
- 1,602 settled (41 never settled)
- 2,762 claims (1.72 per settled battle - traders exit manually, not paid out on settlement)

Ratios:
- 2.83 buys per sell (traders hold to settlement rather than trading out)
- 7.95 trades per created battle

Also shows signer concentration: how much of the program's activity is the
treasury wallet (which signs battle creation and settlement by design) versus
user traders. This asymmetry is expected and documented here so it cannot be
misread as centralization.

## 10. Treasury balance tracking

The treasury wallet (`FNj...kq37`) balance is tracked daily via Dune query 7717935.
Each day records:
- **Close**: the last transaction's post-balance for that UTC day
- **Intraday high**: the peak balance that day (may be higher than close if funds
  were skimmed before day-end)

The operating floor is 3.5 SOL (tunable in `components/BalanceDashboard.tsx`).
Section 02 shows bars for daily close and a line for the intraday high, with the
floor marked as a reference line.

The floor model (section 05) splits any surplus above 3.5 SOL as: 33% operations,
22% each to Hurricane, Candy, and Zaal. Distribution recipient wallets and history
are in `lib/distributions.ts`.

## 11. Data staleness & validation

`scripts/validate.mjs` runs as a pre-build step and checks:
- Battle snapshots: 800-5000 entries (warns if empty/truncated)
- On-chain activity: entries exist for every expected date range
- Field presence and type correctness across all data files
- **vercel.json ignoreCommand**: must be under 256 characters

The last check is a genuine operational trap. Vercel caps ignoreCommand at 256
characters and rejects the ENTIRE vercel.json on validation failure - schema
rejects before any build starts, no build log, no error message with details,
just an instant deploy failure. A 302-character command shipped once and cost
a production deploy and hours of misdirected troubleshooting. That cannot happen
again - validate guards it.

The script also warns at 14 days old and flags data as stale at 45 days.
Run with `--strict` to fail the build on staleness.

```bash
npm run validate          # warns only
npm run validate -- --strict  # fails build if data > 45 days old
```

Staleness dates are checked against `lib/freshness.ts`. After any data refresh,
bump the `DATA_AS_OF` timestamp there and re-run validate.

## 12. Environment, deploy, security

### Development (.env.local)

```
DUNE_API_KEY=<key>
DUNE_QUERY_ID=7717935
DUNE_DEFAULT_WALLET=FNjYtw...kq37
```

### Production (Vercel) - CRITICAL

Set the same vars in Vercel Production environment, plus:

```
CRON_SECRET=<random-secret>
```

**CRITICAL:** Without `CRON_SECRET` set in Vercel Production, the daily cron
(9 AM UTC, defined in vercel.json) will return 401 on `/api/balance?refresh=1`.
The query will not re-run. The treasury balance chart on section 02 will freeze
at its last successful run and never update again. This already happened once,
for 64 days, before the missing env var was found. It is the single most
important operational detail in the entire repo. Treat it as a required checklist
item before any deployment.

To verify: `vercel env pull` and check that `CRON_SECRET` is present and set.

### Security

- The Dune key never reaches the client - confirmed by grepping built `.next/static`
  (0 hits) and by `lib/dune.ts` carrying `import "server-only"`.
- `?wallet=` / `?mint=` parameters are base58-validated before any Dune credit
  is spent (prevents address-enumeration attacks).
- `.env.local` and `.vercel/` are gitignored.
- The `/api/balance?refresh=1` endpoint is gated by `CRON_SECRET` bearer token
  (prevents anonymous credit-burn).
- CSP frame-ancestors restricts embed framing to wavewarz.info, wavewarz.com,
  and Vercel preview builds (prevents drive-by iframe hijacking).

## 13. Constraints & deferred work

Dune is a free-tier account (~2,500 credits/mo). Single-table aggregations
over `instruction_calls` / `account_activity` work fine. Joins of
`account_activity` to a tx-set time out at 2 minutes.

Deferred (would need a paid Dune tier or Helius RPC + Supabase):
- Per-trader volume leaderboard (GROUP-BY-signer join times out)
- Per-battle PnL + win rate (needs Battle PDA decode)
- Artist-payout tracing (needs getProgramAccounts over Battle PDAs)
- Sell-side volume (to match reported both-sides total)
- Ops-budget wallet + weekly-skim quantification
