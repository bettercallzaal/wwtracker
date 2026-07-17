# WaveWarZ community research: charity battle verification, Farcaster presence, DJ Wavy

**Date:** 2026-07-16
**Angles covered:** PolyRaiders charity battle verification; Farcaster/Warpcast presence; DJ Wavy AI judge community context
**Fetch status this run:** WebFetch fully operational (wavewarz.info, wavewarz.info/events, zaofestivals.com/zaostock.com, fxtwitter.com, GitHub — all reached; x.com returns 402 gated, wavewarz.com returns 403, nitter.net returned empty, farcaster.xyz channel pages return only the word "Farcaster" — JS-gated). X posts remain read-only via search snippets only.

---

## Summary

This run upgraded three previously-Unverified findings to Verified by fetching the official WaveWarZ events page at `wavewarz.info/events` (title: "Events & Philanthropy — WaveWarZ Intelligence"), confirmed the Farcaster integration that ZAOOS already references is real and GitHub-documented, and established that DJ Wavy is an official platform feature with a defined 2-of-3 decision mechanism but no independently-indexed community controversy. The charity battle turns out to be a two-part series (not one event), and the first event date (December 12, 2024) conflicts with the snowflake-decoded tweet date (December 13, 2025), which is flagged as a discrepancy requiring clarification. No Nathan Hill / Liquid NFTs donor match could be confirmed from any fetched source.

---

## Verified findings

### 1. Benefit Battle series — two events, not one

The prior doc (`2026-07-15-community-charity-battle.md`) described the WaveWarZ x PolyRaiders charity event as a single Dec 2025 battle. The `wavewarz.info/events` page (fetched 2026-07-16) documents it as a **two-round series** under the heading "Events & Philanthropy":

**Round 1 — Holiday Heat Benefit Battle**
- Matchup: IndieZ (Independent Artists) vs ClassicZ (Global Hits)
- Date listed on the events page: **December 12, 2024**
- Funds raised: ~$270 USD (≈ 3.61 SOL) in fiat donations
- Series result: IndieZ won

**Round 2 — Love Song Benefit Battle**
- Matchup: IndieZ vs ClassicZ
- Date listed: **February 13, 2025** (Valentine's Day eve)
- Funds raised: ~$1,221 USD (≈ 16.32 SOL) in fiat donations
- Series result: IndieZ won

**Combined total reported on the events page:** ~$1,497 USD across both battles (~$6 of that figure is onchain SOL; the remainder is fiat via credit/debit, PayPal, Apple Pay, Google Pay). The page states "Platform fees waived — 100% to charity" and cites Solscan for on-chain transparency.

**Source:** `https://wavewarz.info/events` — page fetched directly 2026-07-16. Treated as **Verified** since it is the platform's own public-facing events page with specific dollar amounts, dates, and a named charity partner.

**PolyRaiders identification (Verified):** The events page describes PolyRaiders as "a multichain art & impact project co-founded by Ryajala (age 10) and her sisters," operating through the **HuRya Empowerment Foundation**, which has distributed supplies to over 8,500 beneficiaries globally. This is consistent with the prior doc's finding (PolyRaiders' later X post thanking minters for reaching 1,000 girls with sanitary pads) and the Facebook reference to HuRya Empowerment Foundation paying school fees. PolyRaiders is a real, ongoing organization; its WaveWarZ partnership across two battle events is now confirmed by the platform's own events page.

**Battle format detail (Verified):** Search snippet for the Holiday Heat recap tweet (x.com/WaveWarZ/status/1999858390567117201) includes verbatim text: "Round 1 (The Warm Up)" with named songs — "What I Want for Christmas" by @MetaVerseSlim and "Grandma Got Jumped by a Reindeer" by @InkSpireMusic representing IndieZ. ClassicZ won regulation rounds 2-1; IndieZ won in overtime/sudden death. This is search-snippet sourced (tweet itself returns 402 gated); treat as high-confidence unconfirmed (snippet text is verbatim, not summarized).

---

### 2. Date discrepancy: event date vs tweet date

The events page records the Holiday Heat battle on **December 12, 2024**. The recap tweet (status/1999858390567117201) that covers that battle decodes via Twitter snowflake epoch to **December 13, 2025** — a full year later. This means either:

(a) The recap tweet was published ~12 months after the event (a retrospective post, possibly tied to a one-year anniversary or platform marketing), or
(b) The events page date is incorrect (data-entry error) and the event actually happened in December 2025 as originally inferred.

The platform's own events page is the only directly-fetched source; the snowflake decode is calculated from the tweet ID (mathematically precise). Both data points are therefore reliable in isolation. The conflict cannot be resolved from available sources this run and is flagged here for manual verification (e.g. checking WaveWarZ's X timeline for December 2024 vs December 2025 activity, or asking a founder directly).

**Impact on prior doc:** The prior doc (`2026-07-15-community-charity-battle.md`) inferred the tweet date as the event date and labeled it December 2025. If the events page date is correct (December 2024), the charity battle precedes the ZAO-CHELLA Art Basel event (also December 2024 in Wynwood, Miami) and is older than previously documented. If the tweet date is correct (December 2025), the events page date is wrong. This needs a human call.

---

### 3. Farcaster presence — integration confirmed, standalone channel not confirmed

**Verified (via GitHub fetch of ZAOOS README, 2026-07-16):**
- The ZAOOS codebase (`bettercallzaal/ZAOOS`) is explicitly "built on Farcaster with encrypted messaging via XMTP" and originally described as a "gated Farcaster social client for The ZAO."
- Sign In With Farcaster (SIWF) is the authentication mechanism (via Neynar managed signers).
- The Farcaster primary community channel for The ZAO is **`/zao`** — referenced in the README as the main hub.
- The builder/primary account is listed as [@zaal on Farcaster](https://farcaster.xyz/zaal).
- WaveWarZ has a `GeneratePostButton` component (`src/components/wavewarz/GeneratePostButton.tsx`) that lets users share battle stats directly to Farcaster from inside ZAOOS. This is the documented WaveWarZ x Farcaster integration.
- BetterCallZaal's X bio includes "(on farcaster)" and the handle `@bettercallzaal` surfaced on both X and in Farcaster contexts consistently across multiple searches.
- A search snippet (not fetched) reports that BetterCallZaal "celebrated the release of WaveWarZ" in conjunction with "news of Farcaster Pro" during the "Let's Talk About Web3" episode.

**Not confirmed this run:**
- A dedicated `/wavewarz` Farcaster channel does not appear in search results. The ZAO's Farcaster presence routes through `/zao`.
- The `farcaster.xyz/bettercallzaal` profile page renders only the word "Farcaster" (JS-gated SPA — no content accessible via WebFetch). Follower count and recent casts not retrievable this run.
- The `farcaster.xyz/~/channel/zao` channel page has the same JS-gating issue — no member count or post history could be fetched.
- `wavewarz.info` (fetched directly) lists no Farcaster integration in its own navigation or feature list — the GeneratePostButton lives in ZAOOS, not in the wwtracker app this repo serves.

**Summary on Farcaster:** WaveWarZ-related content does appear on Farcaster via the `/zao` channel and the @zaal/@bettercallzaal account, and the ZAOOS codebase has a native "share to Farcaster" button for battle stats. There is no standalone `/wavewarz` channel or `@wavewarz` Farcaster account confirmed. The platform itself (`wavewarz.info`) does not surface Farcaster in its navigation. Farcaster is a ZAO-layer feature, not a WaveWarZ-layer feature in the current app architecture.

---

### 4. DJ Wavy — function confirmed, community controversy not found

**Verified (fetched from wavewarz.info, 2026-07-16):**
- DJ Wavy is the AI judge in WaveWarZ's **Quick Battle** format (distinct from Main Event battles).
- Decision mechanism: **"Poll + Charts (SOL) + DJ Wavy AI Judge, 2 out of 3."** A winner requires two of the three criteria to align.
- DJ Wavy's input incorporates trading volume data (volume velocity, recency, engagement) alongside community poll results — not a standalone black-box AI verdict.
- Quick Battles featuring DJ Wavy run every weeknight at 8:30 PM EST on X Spaces and YouTube.

**No independently-indexed community controversy found:** Searches for "DJ Wavy WaveWarZ community reaction," "DJ Wavy AI judge controversial," and similar queries returned no results discussing DJ Wavy specifically in the context of WaveWarZ. Search results either surfaced unrelated musicians named "DJ Wavy" or generic AI-in-music industry coverage. This is absence of evidence, not evidence of absence — given WaveWarZ's relatively small audience and X-gated content, community discussion may exist primarily in X Spaces (which are not web-indexed) and not yet be broadly searchable.

**No viral DJ Wavy moments found:** No YouTube clips, Reddit threads, or indexed social posts reference a controversial or notable DJ Wavy ruling. The character appears to function as a legitimate platform mechanic rather than a community lightning rod, at least based on what is web-indexable as of 2026-07-16.

---

### 5. ZAO-CHELLA — WaveWarZ live event at Art Basel (confirmed)

Fetched `zaostock.com/festivals` (redirect from `zaofestivals.com`, 2026-07-16): ZAO-CHELLA took place in **Wynwood, Miami** during **December 2024** (Art Basel week, specifically December 6, 2024 based on search snippet). WaveWarZ LIVE was featured as a component of the event. A WaveWarZ LIVE Rematch pitting **Hurric4n3ike vs JANGO UU** occurred at 6:00 PM. This is the first confirmed instance of WaveWarZ operating as a live in-person event format (not just an online X Spaces/YouTube format).

---

### 6. Platform stats (live API, fetched 2026-07-16)

`wavewarz.info/api/public/stats` returned (current as of fetch):
- Total battles: 1,244 (Quick: 1,046; Main: 162; Main Events: 50; Community: 36)
- Total SOL volume: 522.09 SOL ($39,057.24 USD)
- Artist payouts: 9.05 SOL ($676.98 USD)
- Trader claims: 127.34 SOL ($9,526.55 USD)
- Platform revenue: 17.42 SOL ($1,302.83 USD)
- Last 24h volume: 0.57 SOL; Last 7d: 12.09 SOL

---

## Unverified / needs follow-up

- **Nathan Hill / Liquid NFTs donor match** — mentioned in prior doc as matching the fiat donations for the Holiday Heat battle. Neither `wavewarz.info/events` nor any fetched source mentions Nathan Hill or Liquid NFTs. `wavewarz.com/donate` returned 403 this run. The claim originates from search snippets only; not confirmed.

- **Exact Holiday Heat battle date (2024 vs 2025)** — see date discrepancy section above. Needs manual check (WaveWarZ founder or X timeline review).

- **Love Song Benefit Battle tweet / recap** — the February 13, 2025 event is listed on the events page, but no recap tweet or X post for it surfaced in search. May exist; not found this run.

- **DJ Wavy algorithm specifics** — the 2-of-3 mechanism is confirmed, but what model or data source powers the "DJ Wavy AI Judge" component (LLM, rule-based, third-party API) is not documented on any fetched page.

- **`/zao` Farcaster channel member count and WaveWarZ post frequency** — channel page is JS-gated; not fetchable this run. Could be checked by a logged-in Farcaster client.

- **`@bettercallzaal` Farcaster profile stats and recent WaveWarZ casts** — same JS-gating issue. Profile exists (confirmed by search) but content not fetchable via WebFetch.

- **Whether there is now a `/wavewarz` Farcaster channel** — not found in search; absence not confirmed (search operators for site:farcaster.xyz were ineffective this run due to tool limitations with site: operators).

---

## Why this matters for wwtracker

- The events page finding means there is **a second charity battle** (Love Song Benefit Battle, Feb 2025, $1,221 raised) that was not in prior research. Combined with the Holiday Heat ($270), the total charitable impact is ~$1,497 — substantially more than the single-event figure in the earlier doc. If `Ecosystem.tsx` or `Events.tsx` ever surfaces community/charity content, both events need to be represented.
- The Farcaster `GeneratePostButton` in ZAOOS is a live, code-verified WaveWarZ social feature that this repo (wwtracker) does not have. If parity with ZAOOS is a goal, this is a gap.
- DJ Wavy's 2-of-3 decision structure (poll + charts + AI) means the AI judge cannot unilaterally override community vote + trading signal — a detail that might matter for community trust/feature explanations if a "How It Works" section is added to the app.
- ZAO-CHELLA confirms WaveWarZ can operate as a live IRL format, not just online — relevant if an Events section in the app ever covers in-person appearances.
