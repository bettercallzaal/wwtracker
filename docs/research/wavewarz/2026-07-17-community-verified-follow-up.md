# WaveWarZ community research — verified follow-up (2026-07-17)

**Angle:** Re-run of 2026-07-15 community research with working WebFetch. Goal:
verify the leads that were blocked by network outage across all five 2026-07-15
research docs.

**Result:** Worked. WebFetch active this run. New verified findings below.

---

## Verified

### Telegram channel: `wavewarzclipshq` (WaveWarZ Clips HQ)

Confirmed via direct fetch of wavewarz.info (2026-07-17). The page lists
"Telegram (WaveWarZ Clips HQ)" as a community link alongside X, YouTube,
and Solscan. This is the Clippers program submission channel — community members
submit battle highlight clips for distribution on YouTube, X, and TikTok.

Prior docs noted "Submission via Telegram" without the handle. Handle is now
confirmed: **`wavewarzclipshq`**. Already updated in docs/WAVEWARZ-RESEARCH.md
§8 Clippers section (PR #55 amended 2026-07-17).

### YouTube @wavewarz

Confirmed active via wavewarz.info. The site references the YouTube channel in
its navigation and documents daily live streams at 8:30 PM EST (Quick Battle
nights). YouTube body content is not directly fetchable (truncated by the fetcher),
but the channel URL `youtube.com/@WaveWarZ` is confirmed as the canonical stream
destination alongside X Spaces.

### wavewarz.info social/community links (confirmed)

Direct fetch returned the full navigation:
- **X (Twitter):** X Spaces Daily at 8:30 PM EST; Community AMA & Feedback 11 AM EST weekdays.
- **YouTube:** @wavewarz — streaming Quick Battles nightly.
- **Telegram:** WaveWarZ Clips HQ (`wavewarzclipshq`) — Clippers submission.
- **Solscan:** program `9TUf...g2fYo` onchain view.
- **Footer:** wavewarz.com (main site), Privacy Policy, Terms of Service.

No Discord or public general community chat link surfaced on wavewarz.info.
Discord/Telegram community chat remains unconfirmed.

### Kata7yst on Audius (VERIFIED — already in lib/artists.ts)

Audius fetch confirmed: handle `Kata7yst`, ID `G2wYPPx`, 19 tracks, 31 followers,
bio says "Follow my socials| WaveWarZ". Tracks include diss-style battle entries
("Erosion(Rocky2Grimey Diss)", "Rude Awakening(Pebbles Diss)") consistent with
WaveWarZ battle participation. ID already added to lib/artists.ts (Audius map).

### "Let's Talk About Web3" — redirect confirmed

`ltaw3.thezao.com` redirects to `pods.media/lets-talk-about-web3` (302 Found).
Pods.media returned 402 (paywall), so episode content was not accessible. But the
redirect and existence of the show are confirmed. Prior finding stands: BetterCallZaal
co-hosts this show alongside EZ and Ohnahji; Episode 5 reportedly celebrated the
WaveWarZ release. The show lives in the ZTalent/ZAO ecosystem.

### Live stats snapshot (2026-07-17T01:36Z, source: wavewarz.info/api/public/stats)

```
volume.totalSol:       521.75 SOL  ($39,397)
battles.total:         1,241
battles.mainEvents:    50
battles.mainBattles:   162
battles.quickBattles:  1,043
battles.communityBattles: 36
artistPayouts.totalSol: 9.05 SOL
traderClaims.totalSol: 127.34 SOL  (939 withdrawals)
platformRevenue.totalSol: 17.38 SOL
```

Key ratio: **127.34 SOL returned to traders** (via claimShares) out of 521.75 SOL
total volume = **24.4% of volume flows back to winning traders**. This is the first
time `traderClaims` has been captured as a named metric. Added to `lib/battles.ts`
BATTLE_STATS as `traderClaimsSol` (PR #42 amended 2026-07-17).

---

## New intel — needs verification

### thezao.com/about: "Super votes" and "sponsorship auctions"

thezao.com/about (fetched 2026-07-17) describes WaveWarZ as: *"an onchain music
competition where artists battle by showcasing their best songs to win a prize for
themselves and a fan. Fans can vote through Super votes and sponsors can participate
via sponsorship auctions."*

Neither term ("Super votes" or "sponsorship auction") appears on wavewarz.info, in
the wwtracker codebase, or in docs/WAVEWARZ-RESEARCH.md. Likely interpretations:
- "Super votes" = the **Poll** component of V2 judging (community vote → winner gets
  Points votes, which was rebranded or described differently on the ZAO site).
- "Sponsorship auctions" = a feature not yet launched or not yet documented.

**Status:** Unverified. Do NOT add to product docs or FAQ until confirmed against
wavewarz.info or the program IDL. Filed here as a lead for Zaal to clarify.

### wavewarz.com

Returned 403 on direct fetch. Could not verify community links or homepage content.
Assumed to be the main marketing/onboarding site per existing docs.

### "Wave Warz Zm" YouTube channel (UC4CTlM4Y6EZF0G9MBBAjwZQ)

YouTube channel URL returned truncated content — only footer/navigation visible.
Cannot confirm the channel's identity or connection to WaveWarZ. Likely unrelated
regional spinoff or a different "wavewarz" entity (possibly in Zambia, per earlier
search snippet). No verification possible with available tools.

### Crypto Magic Hour Ep. 50

Search snippet from 2026-07-15 referenced this show mentioning WaveWarZ. No
additional fetch attempt made this run (YouTube returns truncated content). Leave
as a noted external-coverage lead.

---

## Summary of what changed

| Lead | Prior status | Now |
|------|-------------|-----|
| Telegram channel handle | Unverified (known: "via Telegram") | **VERIFIED**: `wavewarzclipshq` |
| YouTube @wavewarz | Unverified (assumed) | **CONFIRMED** via wavewarz.info |
| Kata7yst on Audius | Unverified (search snippet) | **VERIFIED**: ID G2wYPPx, in lib/artists.ts |
| "Let's Talk About Web3" | Unverified | Redirect confirmed; content paywalled |
| "Super votes" / sponsorship | Not known | Surfaced from thezao.com/about; unverified |
| wavewarz.com | Not fetched | Still 403 |
| "Wave Warz Zm" YouTube | Search snippet | Content truncated; still unverified |

---

## Sources

- wavewarz.info (direct fetch, 2026-07-17)
- wavewarz.info/api/public/stats (direct fetch, 2026-07-17T01:36Z)
- thezao.com/about (direct fetch, 2026-07-17)
- api.audius.co (Kata7yst user + tracks, 2026-07-17)
- ltaw3.thezao.com → pods.media redirect (confirmed 2026-07-17)
