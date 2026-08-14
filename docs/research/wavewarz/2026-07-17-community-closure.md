# WaveWarZ community research — closure (2026-07-17)

**Closes out:** leads from PRs #31-#37 (Jul 15) and #169 (Jul 17 verification doc).  
**Method:** YouTube oEmbed API + wavewarz.info direct fetch.

---

## All open leads resolved

### Wave Warz ZM / WaveWarZ Zambia — NEGATIVE (channel does not exist)

Checked 2026-07-17:

```
curl https://www.youtube.com/oembed?url=https://www.youtube.com/channel/UC4CTlM4Y6EZF0G9MBBAjwZQ → 404 Not Found
curl https://www.youtube.com/oembed?url=https://www.youtube.com/c/WaveWarzZM → 404 Not Found
```

Both return 404. The "Wave Warz Zm" channel referenced in July 15 search snippets does not exist
on YouTube (or has been deleted). This lead is closed as a false positive from search indexing.

**Verdict:** No WaveWarZ Zambia YouTube chapter. The Africa connection (Ram / Songchain) is a
Farcaster/X relationship, not a separate YouTube channel.

---

### All other leads from #31-#37 — resolved status

| Lead | Status | Resolution |
|------|--------|-----------|
| Telegram @wavewarzclipshq | ✅ VERIFIED | Confirmed active in PR #169 + wavewarz.info direct fetch |
| Kata7yst as WaveWarZ artist | ✅ VERIFIED | oEmbed-confirmed in PR #169; added to `lib/artists.ts` (audiusId G2wYPPx) |
| Crypto Magic Hour Ep.50 | ✅ VERIFIED | oEmbed-confirmed in PR #169 (VeVeMagic, independent coverage) |
| Charity battle (PolyRaiders) | ✅ IN APP | `CommunityBattles` component tracks $1,497 total across 2 rounds (Events.tsx §09) |
| Discord / Telegram (main) | ✅ NEGATIVE | No Discord found; only Telegram = @wavewarzclipshq (Clippers program) |
| YouTube live programming | ✅ VERIFIED | wavewarz.info: Mon-Fri 8:30 PM EST X Space + YouTube; 11 AM EST AMA |
| XTinct artist interview | ✅ EXISTING | Already in `docs/WAVEWARZ-RESEARCH.md` §6c before this research |
| Wave Warz ZM channel | ✅ NEGATIVE (this doc) | YouTube 404 — channel does not exist |

---

## Current canonical community channel picture (post-research)

| Channel | Status | Notes |
|---------|--------|-------|
| X @wavewarz | ✅ Live | Primary distribution; daily X Space battles 8:30 PM EST |
| YouTube @wavewarz | ✅ Live | Simultaneous with X Space; artist interview series (XTinct, Kata7yst) |
| Telegram @wavewarzclipshq | ✅ Live | WaveWarZ Clippers program (clips → YouTube/X/TikTok) |
| Discord | ❌ None | Confirmed absent from public search; no official invite ever surfaced |
| Reddit | ❌ Unconfirmed | No WaveWarZ subreddit found in search |
| Farcaster | ⚠️ Minimal | No dedicated /wavewarz channel; ZAO connection via /zao only |

---

## What this means for wwtracker components

All research items are now either in-app (CommunityBattles, Events.tsx §09) or documented as
negative results. No further component changes required from this research thread.

The `Events.tsx` community channel section update (adding @wavewarzclipshq, confirming Discord
absence) is in PR #167 (wave26) — already written, waiting for Zaal to merge.

---

*Closed: 2026-07-17 | Closes research thread from PRs #31-#37, #169*
