# WaveWarZ judging system - V1 vs V2 transition (2026-07-16)

> **RESCUED AND RE-CHECKED 2026-09-19.** This document was written on
> 2026-07-16, pushed to `docs/judging-system-research-2026-07-16`, and never
> merged. It sat on that branch for two months. It is the only description of
> the March 10, 2026 judging change anywhere in this estate, and `main` carried
> nothing on judging at all, which is why it is here now. See
> `docs/BRANCH-AUDIT.md` for how it was found.
>
> **Its headline claim does not survive the re-check, and the body below is left
> unedited so the two can be compared.**
>
> **What holds.** The V1/V2 split itself, the March 10 2026 cutover, the 2-of-3
> rule, and everything in the DJ Wavy section - all of it was read from
> wavewarz.info and from the public `CandyToyBox/wavewarz-intelligence` source,
> and none of it has been contradicted since. The DJ Wavy reliability note
> ("`winner_decided` can sit at false forever") was independently confirmed on
> chain on 2026-09-18: battle 1787568630 reported `winnerDecided: true` while
> `end_battle` had never run, which is the same class of fault from the other
> direction. `docs/SOP.md` SOP 2 now carries that as a standing rule.
>
> **What does not hold: "V2 average volume is 58% lower than V1."** Re-measured
> 2026-09-19 against the chain census
> (`wavewarz-protocol/data/chain-snapshot-2026-09-06/census.json`, 1,643 battle
> accounts, start times 2025-05-26 to 2026-09-05), splitting on the same
> 2026-03-10 cutover:
>
> | era | battles | total pool SOL | mean | median | at exactly 0 | top 1% of battles |
> |---|---|---|---|---|---|---|
> | V1 (to 2026-03-09) | 660 | 103.85 | 0.1573 | 0.0404 | 64 (10%) | 23% of the SOL |
> | V2 (from 2026-03-10) | 983 | 386.00 | 0.3927 | 0.0541 | 50 (5%) | **68% of the SOL** |
>
> **V2's mean is two and a half times V1's, not 58% below it, and its median is
> 34% higher.** The direction of the original finding is reversed.
>
> **Neither number should be used to argue anything about the judging change.**
> Three reasons, and the third is the one that matters:
>
> 1. **They measure different quantities.** The July figure came from the feed's
>    `vol` field; this one is `artist_a_pool + artist_b_pool` read from the
>    battle account, which is SOL sitting in the bonding curve, not lifetime
>    traded volume. A comparison across the two is not like-for-like.
> 2. **The feed's `vol` field is now known to be wrong for some battles.** The
>    volume regression documented in `wavewarz-protocol/recon/` writes the pool
>    into the volume field; 15 battles and 16.34 SOL were affected as of
>    2026-09-19. Whatever the July number measured, part of it was that bug.
> 3. **68% of V2's SOL sits in the top 1% of V2 battles.** July 2026 alone holds
>    245.77 SOL of the 386, against 10.81 in May and 4.07 in the first days of
>    September. A mean over that distribution is a statement about a handful of
>    main events, not about how the average battle behaves. The V1/V2 split
>    straddles a 15-month period in which volume moved for many reasons, and a
>    single cutover date cannot be separated from any of them with this data.
>
> **What would actually answer the question** is the per-battle V2 breakdown -
> Poll win/loss, Charts win/loss, DJ Wavy win/loss - which the original document
> already identified as missing and which is still not in any public feed or
> API. That gap is the finding worth carrying forward, not either average.
>
> Monthly series behind the table, for anyone re-checking:
>
>     2025-05    15    4.56      2026-01   149   16.80
>     2025-06    31    2.85      2026-02   186   24.16
>     2025-07    29    8.45      2026-03   206   53.53  <- V2 starts
>     2025-08    16    3.18      2026-04   188   20.29
>     2025-09    25    8.20      2026-05   137   10.81
>     2025-10    38    5.81      2026-06   139   48.00
>     2025-11    41    3.25      2026-07   173  245.77
>     2025-12    82    6.98      2026-08   155   23.13
>                                2026-09    33    4.07
>
> **Typography only: em dashes normalised to hyphens on restore, no wording
> changed.** 18 characters across this file and the research log. The house
> rule covers every file we commit, and a dash is not a claim.
>
> Everything below this line is the 2026-07-16 document as written, subject
> to that one substitution.

---


**Purpose:** Document the March 10, 2026 judging system change from Charts-Only (V1)
to Poll + Charts + DJ Wavy (V2), and its impact on battle volume.

---

## The two judging systems

### V1 - Charts Only (May 2025 → March 9, 2026)

> "whichever song had the larger SOL pool when time expired" - wavewarz.info

- Winner = whichever song's SOL pool was larger at battle end
- Pure economic signal: traders vote with money
- No human/community poll component, no AI judge

### V2 - Poll + Charts + DJ Wavy (March 10, 2026 → present)

> "Poll + Charts (SOL) + DJ Wavy AI Judge, 2 out of 3" - wavewarz.info

- **Charts**: SOL pool size at settlement (same as V1)
- **Poll**: community vote during the live X Spaces / YouTube stream
- **DJ Wavy**: AI judge that evaluates the battle independently
- Winner requires at least 2 of 3 criteria - any single criterion can be overruled

**Source:** wavewarz.info/battles labels all pre-March-10 battles as
"V1 Winner System: Charts only - whichever song had the larger SOL pool
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
the judging switch. Possible explanations - not mutually exclusive:

1. V1 traders bet *on the Charts outcome*, so every dollar moved the needle
   directly. Under V2, Charts is only 1-of-3 - reducing the marginal value of
   additional trading.
2. V2 was introduced in March 2026 during a broader market softening in on-chain
   activity (see Dune snapshot: peak buy-volume day was 2026-03-02).
3. The Poll and DJ Wavy components pull some trader engagement off-chain
   (community chat, X Spaces voting), reducing the SOL committed.

---

## DJ Wavy - what we know

Source: `CandyToyBox/wavewarz-intelligence` (public) - `src/app/api/webhook/route.ts`
and `src/app/battles/[id]/page.tsx` (read 2026-07-16).

- **Role:** independent AI judge; one of the 3 V2 criteria
- **Weight:** equal to Poll and Charts (each wins or loses; 2-of-3 carries the battle)
- **Origin:** verdict generated by **wavewarz.com**'s backend and sent to the
  intelligence app via webhook. Fields: `dj_wavy_winner` (artist name string) and
  `dj_wavy_reasoning` (text). The intelligence app stores and displays them but
  does not generate them - the AI lives in Hurricane's private backend.
- **Display:** shown in a 3-column "Poll · Charts · DJ Wavy - 2 of 3 wins"
  breakdown on `wavewarz.info/battles/{id}`. DJ Wavy's verdict includes the
  winner name + italic reasoning text (truncated to 3 lines in the UI).
- **Webhook compat:** payload may send `dj_wavy_winner` or `djwavy_winner` (two
  spellings handled via `?? null` fallback in the webhook handler).
- **Tech/model:** not in any public repo. No OpenAI/Anthropic/Claude/GPT references
  found in `wavewarz-intelligence`. The AI prompt and model are in Hurricane's
  private `wavewagerz` repo or wavewarz.com backend.
- **Reliability note:** webhook comment: "winner_decided can sit at false forever for
  a battle that ended hours ago (the DJ Wavy verdict step that sets it can fail to
  fire independent of settlement)." If the DJ Wavy webhook errors, the battle
  settles correctly on-chain but `dj_wavy_winner` may be null in the DB.
- **Controversy:** none found via search - no public community debate about
  specific DJ Wavy rulings surfaced.
- **Deciding-vote frequency:** unknown; would need per-battle Poll W/L + Charts W/L
  + Wavy W/L breakdown, not available in the public feed or API.

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
multi-round tournament brackets - the API counts each round as a battle
(~3 rounds × 50+ events ≈ 150+ records), but the feed appears to
capture only early-round fixtures and missed most inter-round battles.

**Implication for `RECENT_BATTLES` and `BATTLE_STATS`:** the
`BATTLE_STATS.totalShown` (1,240) from the API is the correct count for
display. The feed's 1,089 undercounts due to missing main-event rounds - don't use `feed.length` as the displayed battle count.

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
| How often DJ Wavy is the deciding vote | Needs per-battle V2 score data (Poll W/L + Charts W/L + Wavy W/L per battle) - not in public feed |
| Exact V1→V2 announcement | Search X @WaveWarZ for March 10, 2026 post announcing the system change |
| Poll mechanism (X Spaces vote? tweet poll? in-app?) | Fetch wavewarz.info battle detail page for a recent V2 battle |

---

## Log

- 2026-07-16 22:45 UTC - Discovered V1/V2 system split via wavewarz.info/battles
  UI labels. Quantified from feed: 445 V1 / 644 V2, avg volume drop 58%.
  Documented DJ Wavy as unspecified AI model. Feed coverage gap analysis added
  (main battles only 24% captured). No DJ Wavy controversy found via search.
