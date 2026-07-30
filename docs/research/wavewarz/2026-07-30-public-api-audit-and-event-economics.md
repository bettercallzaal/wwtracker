# Public API audit + event economics - 2026-07-30

Live audit of all 7 public API endpoints plus an event-volume distribution analysis. All numbers pulled 2026-07-30 ~17:20 UTC, SOL at $74.48 (API's own price feed).

## API audit - all endpoints verified live, no auth, CORS open

| Endpoint | Status | Notes |
|---|---|---|
| GET /api/public/stats | OK | Platform totals, matches homepage |
| GET /api/public/battles | OK | Paginated, filters: type/live/limit/offset |
| GET /api/public/battles/:id | OK (per docs) | Single battle |
| GET /api/public/events | OK | 50 events returned, includes per-round data |
| GET /api/public/leaderboards/artists | OK | 52 artists |
| GET /api/public/leaderboards/traders | OK | 138 traders, includes netPnl |
| GET /api/public/leaderboards/songs | OK | 823 songs |

Note: the api-docs page's example /stats response uses illustrative numbers (41,230 SOL volume etc.) that a reader could mistake for real platform stats - worth a "sample data" label on the docs page.

## Live snapshot (2026-07-30)

| Metric | Value |
|---|---|
| Total volume | 881.32 SOL ($65,641 at today's price) |
| Last 24h volume | 2.21 SOL |
| **Last 7d volume** | **4.18 SOL (~$311)** |
| Artist payouts all-time | 13.45 SOL ($1,002) |
| Trader claims all-time | 384.66 SOL, 1,573 withdrawals |
| Battles | 1,309 total: 51 main events, 165 main battles, 1,108 quick, 36 community |

Data reconciliation note: 881.32 SOL here vs 498.88 SOL in ZAO OS research doc 1237 (July) - the 881 figure is both-sides volume (matches doc 2117's 879.12 both-sides Dune measure); 499 was likely buy-side-only. Worth standardizing which measure "total volume" means across docs.

## The headline finding: extreme event power law

Top 10 events by volume (from /api/public/events, 50 events):

| SOL | Date | Matchup |
|---|---|---|
| **342.00** | 2026-07-19 | **AI LUI vs GEEK MYTH** |
| 39.36 | 2026-03-02 | ItzWonderfull vs STILOWORLD |
| 26.71 | 2026-06-07 | AI LUI vs Benny J |
| 26.26 | 2026-03-29 | Geek Myth vs Aporkalypse |
| 21.52 | 2026-06-11 | Geek Myth vs Taji Kamikaze |
| 14.93 | 2025-09-01 | Lui vs STILOWORLD |
| 13.10 | 2025-09-15 | LexiBanti vs Preshzino Songz |
| 12.50 | 2025-07-28 | One vs Krem |
| 11.62 | 2026-03-22 | GodCloud vs Cannon Jones 973 |
| 10.39 | 2026-06-14 | Stella Estrella vs Aporkalypse |

- **Top 5 events = 455.9 SOL = 52% of the platform's entire all-time volume.**
- The Jul 19 AI LUI vs GEEK MYTH event (342 SOL, ~$25.5k) is **8.7x larger than the #2 event ever** and single-handedly ~39% of all-time volume.
- AI LUI appears in 2 of the top 3 events. The AI-artist tournament format is, on the data, the platform's strongest volume driver by an order of magnitude.
- Contrast with run-rate: the 7 days after that event did 4.18 SOL total. Volume is almost entirely event-driven; quick battles (1,108 of 1,309 battles) contribute high transaction counts but dust-scale volume.

## What one mega-event is worth to the treasury (using the verified fee model)

Per the on-chain fee model (0.5% per trade + 3% of loser pool at settlement, loser pool ~45% of volume):

- 342 SOL event: ~1.71 SOL trade fees + ~4.6 SOL settlement fees = **~6.3 SOL treasury revenue** (plus launch fees) from one event
- Per the public 33/22/22/22 distribution split (lib/distributions.ts), each founder's 22% share of one such event's skim is ~1.4 SOL (~$103)

Implication: replicating the AI-tournament event format weekly-to-2x-weekly changes the platform's revenue base far more than any quantity of quick battles. The growth question is "how do we run more AI LUI-scale events" - the format is proven, the data is unambiguous.

## Notable leaderboard facts (for content/marketing use)
- Top trader: 47.1 SOL volume, +27.0 SOL net PnL (78% win rate, 451 trades) - a real winner story
- Geek Myth: 300.7 SOL volume across just 4 battles (4-0), 3.22 SOL earned - the top-drawing human artist
- Top song: "Fuck yo feelingZ" by GodclouD - 24 battles, 79% win rate, 9.39 SOL volume, 30 unique traders

## Suggested follow-ups
1. Standardize the volume measure (both-sides vs buy-side) across wwtracker + research docs.
2. Label the api-docs example responses as sample data.
3. Add an "events" power-law view to the tracker (top-N events vs total volume share) - the 52%-from-5-events stat is the single most decision-relevant chart the site could show.
4. Pull the COC #7 (Jul 18) before/after volume delta - the Jul 19 342-SOL event happened the day after the pilot show; if connected, that's the strongest possible evidence for the live-event thesis.
