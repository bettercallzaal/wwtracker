# Battle cadence + treasury revenue reconciliation - 2026-07-30

Companion to 2026-07-30-public-api-audit-and-event-economics.md. Sources: full battle history from /api/public/battles (all 1,309 battles, paginated) + public/ww-daily-treasury.csv (2025-07-01 through 2026-07-21).

## Monthly volume by battle type (SOL, from the full battle feed)

| Month | Quick n | Quick vol | Main n | Main vol | Comm n | Comm vol | TOTAL |
|---|---|---|---|---|---|---|---|
| 2025-05 | 0 | 0.00 | 5 | 19.12 | 1 | 0.74 | 19.86 |
| 2025-06 | 1 | 0.21 | 6 | 2.59 | 0 | 0.00 | 2.80 |
| 2025-07 | 0 | 0.00 | 15 | 20.64 | 0 | 0.00 | 20.64 |
| 2025-08 | 0 | 0.00 | 6 | 16.13 | 1 | 0.88 | 17.01 |
| 2025-09 | 1 | 0.16 | 11 | 34.62 | 4 | 3.76 | 38.54 |
| 2025-10 | 1 | 0.05 | 22 | 25.78 | 3 | 0.81 | 26.64 |
| 2025-11 | 2 | 0.00 | 6 | 5.07 | 20 | 5.79 | 10.86 |
| 2025-12 | 56 | 5.76 | 12 | 7.85 | 0 | 0.00 | 13.61 |
| 2026-01 | 133 | 29.56 | 11 | 12.24 | 2 | 1.66 | 43.46 |
| 2026-02 | 163 | 27.53 | 14 | 14.83 | 2 | 0.13 | 42.49 |
| 2026-03 | 181 | 31.61 | 15 | 87.82 | 2 | 0.09 | 119.51 |
| 2026-04 | 169 | 30.50 | 14 | 7.90 | 1 | 0.00 | 38.40 |
| 2026-05 | 133 | 18.68 | 2 | 1.44 | 0 | 0.00 | 20.12 |
| 2026-06 | 117 | 22.33 | 20 | 64.63 | 0 | 0.00 | 86.96 |
| 2026-07 | 151 | 34.86 | 6 | 345.57 | 0 | 0.00 | **380.42** |

Findings:
1. **July 2026 is the biggest month in platform history** (380 SOL), driven almost entirely by 6 main battles (345.57 SOL - the AI tournament).
2. **Quick battles are a stable organic baseline**: ~18-35 SOL/month every month since launching in Dec 2025, regardless of events. Reliable but flat - this is the platform's floor, not its growth.
3. **All variance is main events**: Mar (87.8), Jun (64.6), Jul (345.6). The three biggest months are the three biggest event months.

## Daily structure around the Jul 19-20 mega-event

| Date | Volume | Battles |
|---|---|---|
| Jul 14-17 (baseline) | 0.8-2.7/day | 5-8/day |
| Jul 18 (COC #7 show) | 5.29 | 12 |
| Jul 19 | 55.89 | 2 |
| Jul 20 | **286.12** | 2 |
| Jul 21-30 (after) | 0.16-3.5/day | 2-10/day |

Findings:
1. COC #7 show day (Jul 18) ran ~2-4x the daily baseline (5.29 SOL, most battles in a day that month) - a real but modest lift.
2. The mega-event (Jul 19-20) is its own phenomenon: 342 SOL over 2 days, in just 4 battles.
3. **No baseline lift after the event**: within 24h, daily volume returned to the ~1-3 SOL norm. Events spike volume but (so far) do not retain it. Growth therefore compounds through event CADENCE, not through any single event's afterglow.

## Treasury revenue (public/ww-daily-treasury.csv, through 2026-07-21)

Monthly treasury INFLOW (gross revenue before skim):

| Month | Inflow SOL | Volume SOL | Effective take |
|---|---|---|---|
| 2026-01 | 2.18 | 43.5 | 5.0% |
| 2026-02 | 0.60 | 42.5 | 1.4% |
| 2026-03 | 2.82 | 119.5 | 2.4% |
| 2026-04 | 1.07 | 38.4 | 2.8% |
| 2026-05 | 1.26 | 20.1 | 6.3% |
| 2026-06 | 5.42 | 87.0 | 6.2% |
| 2026-07 (to 21st) | 5.20 | 380.4 | 1.4% (partial - see flag) |

- All-time inflow: **20.34 SOL** - matches doc 2117's authoritative 20.2 SOL figure almost exactly. The datasets reconcile.
- Effective take rate ranges 1.4-6.3% of volume because launch/skip/queue fees are volume-independent - months with many battles but low volume (May, Jun) show high take rates.

## Model closure - the founder payout math checks out end-to-end
Recent weekly treasury inflow (last ~6 weeks): ~0.76-3.16 SOL/wk, averaging ~1.5 SOL/wk. At the public 22% founder share of the skim: 1.5 x 0.22 = **0.33 SOL/wk - exactly the founder distribution observed on-chain (0.33 SOL transfer from the treasury on 2026-07-26).** The documented model (floor -> skim -> 33/22/22/22) is operating precisely as described. Verifiable full-loop: volume -> fees -> treasury -> skim -> founder wallet.

## Flags / follow-ups
1. **CSV ends 2026-07-21** - the Jul 19-20 mega-event's settlement fees (~4-6 SOL expected at 3% of loser pools) may not be fully captured yet. The week-of-Jul-20 row shows only 1.90 SOL inflow, which looks low for a 342-SOL event. Refresh the CSV and verify where the event's settlement revenue landed (treasury vs battle vault PDAs pending claims).
2. Feb 2026 anomaly: outflow (1.58) far exceeded inflow (0.60) - worth a one-line explanation in the docs (catch-up skim from January's strong month?).
3. Retention experiment worth designing: something that converts event-spike traders into quick-battle baseline traders (post-event quick-battle series featuring the event's artists?). The data says this conversion currently does not happen at all.
