# WaveWarZ judging system — V1 vs V2 transition (2026-07-16)

**Purpose:** Document the March 10, 2026 judging system change from Charts-Only (V1)
to Poll + Charts + DJ Wavy (V2), and its impact on battle volume.

---

## The two judging systems

### V1 — Charts Only (May 2025 → March 9, 2026)

> "whichever song had the larger SOL pool when time expired" — wavewarz.info

- Winner = whichever song's SOL pool was larger at battle end
- Pure economic signal: traders vote with money
- No human/community poll component, no AI judge

### V2 — Poll + Charts + DJ Wavy (March 10, 2026 → present)

> "Poll + Charts (SOL) + DJ Wavy AI Judge, 2 out of 3" — wavewarz.info

- **Charts**: SOL pool size at settlement (same as V1)
- **Poll**: community vote during the live X Spaces / YouTube stream
- **DJ Wavy**: AI judge that evaluates the battle independently
- Winner requires at least 2 of 3 criteria — any single criterion can be overruled

**Source:** wavewarz.info/battles labels all pre-March-10 battles as
"V1 Winner System: Charts only — whichever song had the larger SOL pool
when time expired. Replaced March 10, 2026."

---

## Battle feed breakdown

Data from `public/ww-battles.json` (1,089 battles, main branch, last updated Jul 14, 2026):

| Era | Battles | Quick | Main | Community | Avg vol (SOL) |
|-----|---------|-------|------|-----------|---------------|
| V1 (before Mar 10, 2026) | 445 | 396 | 27 | 22 | 0.524 |
| V2 (from Mar 10, 2026) | 644 | 630 | 12 | 2 | 0.221 |
| **Total** | **1,089** | **1,026** | **39** | **24** | **0.350** |

**V2 average volume is 58% lower than V1.** This is a strong correlation with
the judging switch. Possible explanations — not mutually exclusive:

1. V1 traders bet *on the Charts outcome*, so every dollar moved the needle
   directly. Under V2, Charts is only 1-of-3 — reducing the marginal value of
   additional trading.
2. V2 was introduced in March 2026 during a broader market softening in on-chain
   activity (see Dune snapshot: peak buy-volume day was 2026-03-02).
3. The Poll and DJ Wavy components pull some trader engagement off-chain
   (community chat, X Spaces voting), reducing the SOL committed.

---

## DJ Wavy — what we know

- **Role:** independent AI judge; one of the 3 V2 criteria
- **Weight:** equal to Poll and Charts (each wins or loses the criterion; 2-of-3
  carries the battle)
- **Tech/model:** not publicly disclosed on wavewarz.info or in any public repo
- **Live appearance:** runs during the Mon-Fri ~8:30 PM EST stream; verdict
  announced alongside the Poll and Charts result
- **Controversy:** none found via search — no public complaints or community
  debate about specific DJ Wavy rulings surfaced
- **Influence:** unclear how often DJ Wavy casts the deciding vote (would need
  per-battle score data, not available in the public feed)

---

## Feed coverage gaps

The `public/ww-battles.json` feed (from `wavewarz-intelligence.vercel.app`)
captures battles scraped from the battle-history pages. Coverage vs the live
stats API (`wavewarz.info/api/public/stats`, July 16, 2026):

| Type | Feed | API | Gap | Coverage |
|------|------|-----|-----|----------|
| Quick battles | 1,026 | 1,042 | 16 | 99% |
| Main battles | 39 | 162 | 123 | 24% |
| Community battles | 24 | 36 | 12 | 67% |
| **Total** | **1,089** | **1,240** | **151** | **88%** |

**Main event coverage is severely gapped (24%).** Main events are
multi-round tournament brackets — the API counts each round as a battle
(~3 rounds × 50+ events ≈ 150+ records), but the feed appears to
capture only early-round fixtures and missed most inter-round battles.

**Implication for `RECENT_BATTLES` and `BATTLE_STATS`:** the
`BATTLE_STATS.totalShown` (1,240) from the API is the correct count for
display. The feed's 1,089 undercounts due to missing main-event rounds
— don't use `feed.length` as the displayed battle count.

---

## Top V2 battles by volume (main branch feed, Charts-era highs)

| Date | Battle | Winner | Volume |
|------|--------|--------|--------|
| Mar 30, 2026 | Geek Myth vs Aporkalypse | Geek Myth | 26.26 SOL |
| Jun 8, 2026 | AI LUI vs Benny J | AI LUI | 17.66 SOL |
| Mar 16, 2026 | LUI vs DCOOP | LUI | 14.73 SOL |
| Mar 23, 2026 | GodCloud vs Cannon Jones973 | Cannon Jones973 | 11.62 SOL |
| Jun 11, 2026 | Geek Myth vs Taji Kamikaze | Geek Myth | 11.10 SOL |

All top-5 V2 battles by volume are MAIN event battles. Quick battle peak in V2
era appears to be the Jun 8 quick result (17.66 SOL).

---

## Items still unverified

| Item | Next action |
|------|-------------|
| DJ Wavy model/tech stack | Check CandyToyBox repos or wavewarz.info source for any hints |
| How often DJ Wavy is the deciding vote | Needs per-battle V2 score data (Poll W/L + Charts W/L + Wavy W/L per battle) — not in public feed |
| Exact V1→V2 announcement | Search X @WaveWarZ for March 10, 2026 post announcing the system change |
| Poll mechanism (X Spaces vote? tweet poll? in-app?) | Fetch wavewarz.info battle detail page for a recent V2 battle |

---

## Log

- 2026-07-16 22:45 UTC — Discovered V1/V2 system split via wavewarz.info/battles
  UI labels. Quantified from feed: 445 V1 / 644 V2, avg volume drop 58%.
  Documented DJ Wavy as unspecified AI model. Feed coverage gap analysis added
  (main battles only 24% captured). No DJ Wavy controversy found via search.
