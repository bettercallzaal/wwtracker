# WaveWarZ community research — follow-up verification (2026-07-16)

**Purpose:** Resolve items left Unverified in the 2026-07-15 community research run
(PRs #31–#37), now that WebFetch access to general web domains is restored.

---

## Items resolved this run

### Kata7yst — confirmed WaveWarZ artist (Audius verified)

**Status: VERIFIED** (direct Audius API fetch, 2026-07-16)

- **Audius handle:** `kata7yst` — **Audius ID:** `847467862`
- **Bio (live from Audius):** "Follow my socials| WaveWarZ" — explicit WaveWarZ affiliation
- **Track count:** 21 — **Followers:** 31
- **Social:** Instagram: kata7yst / TikTok: kata7yst302 / Twitter: kata7yst
- **Battle track (confirmed on Audius):** "Limit Breaker Ft Cannon Jones" → `3AkrXjM`
  - 58 plays, 18 reposts; released 2026-02-28; genre: Hip-Hop/Rap
  - Battled against PKMNCTO's "Dead Already" on **2026-07-16** (today); result: L (0.028 SOL volume)
  - Battle confirmed via direct fetch: `wavewarz.info/battles?search=kata7yst`
- **Roster note:** Kata7yst's "Erosion(Rocky2Grimey Diss)" is a track aimed at
  RoCkY2GriMeY (already a verified WaveWarZ artist), confirming Kata7yst is embedded
  in the WaveWarZ artist circle, not just incidental.

**Action taken:** Added to `docs/WAVEWARZ-RESEARCH.md` §6c (Audius integration).

---

### Charity battle tweet — partially verified

**Status: PARTIALLY VERIFIED** — the tweet exists and the event is real; exact
fiat/SOL breakdown is still search-snippet-sourced.

- Tweet `x.com/WaveWarZ/status/1999858390567117201` confirmed to exist in search results
  (2026-07-16) — the WaveWarZ account posted a "WAVEWARZ CHARITY BATTLE RECAP: Indies vs.
  Classics" post raising "$270+" for PolyRaiders. WebFetch to `x.com` still returns login
  gates (expected — X requires auth), so the exact wording was not re-read from the tweet
  directly. The search snippet corroborates the 2025-12-13 date (snowflake decode) and the
  "$270+" figure. Treating as real and dated.
- PolyRaiders confirmed as a live org: recent posts (2026-05-06) on X mention 767 mints
  and girl-child sanitary pad initiative — a real NFT-for-good project, not defunct.

---

### New name: PKMNCTO

Found on `wavewarz.info/battles` today (2026-07-16): battled Kata7yst with "Dead Already"
(Kata7yst's "Limit Breaker Ft Cannon Jones" vs PKMNCTO's "Dead Already" — PKMNCTO won).
**Not yet in `lib/artists.ts` or `docs/WAVEWARZ-RESEARCH.md`**. Audius match not confirmed
yet — adding as a follow-up lead, not a verified roster entry.

---

### ZAO parent community — confirmed via GitHub (unchanged from #35)

The verified ZAO connection documented in `2026-07-15-zao-community-link.md` stands:

- The ZAO is a 188-member decentralized music community (Base-chain, ORDAO governance)
- `bettercallzaal/ZAOOS` independently tracks WaveWarZ (43-artist roster, nightly syncs,
  DAO proposal auto-drafts from battle milestones)
- Farcaster-first, with encrypted messaging via XMTP; `thezao.com` and `thezao.xyz`
  are the public-facing hubs

**Action taken:** Added The ZAO parent community context to `docs/WAVEWARZ-RESEARCH.md` §1.

---

### PKMNCTO — confirmed WaveWarZ artist (Audius verified, 2026-07-16)

**Status: VERIFIED** (direct Audius API fetch, 2026-07-16)

- **Audius handle:** `pkmncto` — **Audius ID:** `340717612`
- **Name:** PKMN CTO
- **Bio:** "PKMN (Play • Keep • Master • Network) • Dev builds • Tess is the Voice • Together we're connecting music, technology, and community through emotional storytelling, digital innovation, and immersive world-building"
- **Track count:** 17 — **Followers:** 16
- **Battle track (confirmed via wavewarz.info feed):** "Dead Already" — battled Kata7yst's "Limit Breaker Ft Cannon Jones" on 2026-07-16; won (0.028 SOL volume)
- **Audius track ID for "Dead Already":** `j48qp7j` — 21 plays, released 2026-06-02, genre Hip-Hop/Rap (verified via `/v1/users/340717612/tracks` 2026-07-16)

Note: "PKMN" in the bio and name is the same artist referenced in RoCkY2GriMeY's already-verified track "High Frequency with PKMN" (`mWpBmxQ`) — PKMNCTO is the full entity behind that collaboration.

**Action taken:** Added `PKMNCTO` → `ZOOMN24` to `docs/WAVEWARZ-RESEARCH.md` §6c (verified 2026-07-16). "Dead Already" → `j48qp7j` added to verified-song table.

---

## Items still unverified

| Item | Why still unverified | Next action |
|---|---|---|
| ~~"Dead Already" Audius track ID~~ | ~~Not searched~~ | **RESOLVED** `j48qp7j` (2026-07-16) |
| Kata7yst win/loss history beyond today's battle | One battle in feed | `wavewarz.info/battles?search=kata7yst` pagination when more data accumulates |
| Charity battle exact SOL amount per side | X requires auth | Accept $270+ / ~0.14 SOL as search-verified enough for display; exact breakdown is secondary |
| Let's Talk About Web3 (pods.media episodes) | pods.media still 403 | Not blocking anything in the app currently |
| ZAO-CHELLA (zaofestivals.com) | Not fetched this run | Low priority — no direct wwtracker app implication |

---

## Audius numbers update (post-Kata7yst addition)

Adding Kata7yst to the confirmed-artist set:

| Artist | Audius ID | Tracks | Key battle track |
|---|---|---|---|
| GodclouD | `Vg1rWzQ` | (prev. confirmed) | "Fuck yo feelingZ" `0X6BQ99` |
| BennyJ504WaveWarz | `RGyPJRg` | (prev. confirmed) | "What the: Unreleased" `dY4Q23y` |
| RoCkY2GriMeY | `aNYwwmo` | (prev. confirmed) | "High Frequency with PKMN" `mWpBmxQ` |
| Kata7yst | `847467862` | 21 | "Limit Breaker Ft Cannon Jones" `3AkrXjM` |
| PKMNCTO | `ZOOMN24` | 17 | "Dead Already" `j48qp7j` |
| Hurric4n3Ike | `lzq2G` | 48 | founder |
| NDA_WaveWarz | `oGZ6o3J` | (prev. confirmed) | |

---

## Log

- 2026-07-16 18:10 UTC — Resolved Kata7yst via Audius API (direct fetch, working today).
  Partially confirmed charity battle via search snippet. Noted PKMNCTO as new unverified
  lead. Updated WAVEWARZ-RESEARCH.md §6c + §1 with verified facts.
- 2026-07-16 22:35 UTC — Resolved PKMNCTO Audius track ID: "Dead Already" → `j48qp7j`
  (21 plays, released 2026-06-02). Added PKMNCTO `ZOOMN24` to §6c verified-artist table
  and "Dead Already" to verified-song table. 7 confirmed artists total.
