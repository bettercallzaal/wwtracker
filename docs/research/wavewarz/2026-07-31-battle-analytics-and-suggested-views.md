# Battle analytics + suggested tracker views - 2026-07-31

Analysis of all 1,309 battles (full public-API history) to power new wavewarz.info views. Existing components checked first (Artists, Battles, Events, Leaderboard, Traders, TraderScorecard, Songs, PlatformGrowth, PlatformAnalytics, Profitability, WeeklyRevenueAnalytics, BalanceDashboard, OpsLedger, OnChainProof, tournament page) - everything below is NEW, not duplicated.

## Finding 1: blowout money beats coin-flip money
Volume-margin buckets (share of money on the winning side):

| Money split | Battles | Avg volume |
|---|---|---|
| 0-20% margin (coin flip) | 416 | 0.474 SOL |
| 20-50% (competitive) | 451 | 0.568 SOL |
| 50-80% (favorite) | 205 | 0.937 SOL |
| 80-100% (blowout) | 217 | **1.087 SOL** |

Counterintuitive: lopsided battles carry MORE volume, not less. Likely causation: big battles attract informed/whale money that piles onto one side - lopsidedness is a symptom of stakes, not a deterrent. Either way, "fair matchmaking = more volume" is NOT supported; promotion and stakes drive volume, competitiveness doesn't.

## Finding 2: artist draw power is extremely concentrated (and the data has an identity bug)
Top artists by total SOL involved in their battles:

| Artist | Battles | SOL involved | Avg/battle |
|---|---|---|---|
| LUI | 11 | 357.0 | 32.5 |
| GEEK MYTH | 3 | 342.0 | 114.0 |
| Geek Myth | 10 | 56.2 | 5.6 |
| Aporkalypse | 8 | 41.7 | 5.2 |
| ItzWonderfull / STILOWORLD | 3 each | 39.4 | 13.1 |
| AI LUI / Benny J | 3 each | 26.7 | 8.9 |

**Bug found: "GEEK MYTH" and "Geek Myth" are the same artist split across two identities by name-casing.** Same likely for LUI/AI LUI. Artist stats should key on WALLET, not name string - affects the Artists component, leaderboards, and any artist page. Merged, Geek Myth is ~398 SOL across 13 battles - by far the platform's #1 draw.

## Finding 3: polls and money are different audiences
- Battles WITH poll votes: 550, average 0.170 SOL volume
- Battles WITHOUT poll votes: 759, average 1.038 SOL volume

Poll-heavy battles are the casual/community lane; big money battles skip polls entirely. Not causal, but a clean segmentation: the voter audience and the trader audience barely overlap today - converting voters into traders is an untapped funnel.

## Finding 4: volume concentration, battle level
- **Top 10 battles ever = 50.0% of all volume**
- Top 100 = 76.7%
- 682 of 1,309 battles (52%) did under 0.1 SOL

## Suggested new views for wavewarz.info - ranked by build ease

### Easy (data already in the public API / client-side computable)
1. **Prime Time heatmap** - hour-of-day x day-of-week volume grid. Instantly answers "when should I schedule/show up." Data: battle createdAt + volume, already served. (The 9pm ET peak and Sun/Wed anchors become visible to everyone, including artists picking slots.)
2. **Battle Size Pyramid** - concentration curve (top-N battles vs share of volume) with the 50%-from-10-battles headline. Makes "events are everything" self-evident to any visitor/investor/grant reviewer.
3. **Artist Draw Power board** - avg SOL per appearance, keyed by wallet (fixes the identity bug at the same time). Sortable: who moves money when they battle. Artists will share their own cards - free marketing.
4. **Money Margin per battle** - favorite vs underdog money split on each battle page. Traders love seeing where the money sits; it's also the "price = probability" education moment (prediction-market framing).

### Medium (needs a small data addition)
5. **Daily Unique Traders line** - THE health metric (volume lies, events spike it). Needs per-day distinct buyShares signers via Dune or Helius (already scoped in doc 1237, free tier suffices). Put "X traders today" on the homepage - it's also social proof.
6. **Next Battle countdown** - homepage widget for the nightly 9pm ET featured battle (per the daily-trading growth plan). Turns the tracker into a tune-in surface, not just a rearview mirror.

### Data-quality fixes surfaced by this analysis
7. Canonical artist identity by wallet (GEEK MYTH/Geek Myth bug) - affects existing Artists/Songs/Leaderboard components too.
8. Label the api-docs example responses as sample data (from the 07-30 API audit doc).
9. Refresh public/ww-daily-treasury.csv past 2026-07-21 and verify where the Jul 19-20 mega-event settlement fees landed (expected ~4-6 SOL; the CSV week shows only 1.9).
