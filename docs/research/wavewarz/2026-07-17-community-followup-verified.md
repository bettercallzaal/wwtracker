# WaveWarZ community research — verified follow-up (2026-07-17)

**Goal:** Verify the leads surfaced (but fetch-blocked) in the 2026-07-15 runs
(`2026-07-15-community-presence-leads.md`, `2026-07-15-community-social-presence.md`).  
**Method:** YouTube oEmbed API (`youtube.com/oembed?url=...`) — works where the main
WebFetch fails on JavaScript-rendered YouTube pages.

---

## Verified this run

### 1. Kata7yst — confirmed WaveWarZ featured artist (official interview)

- **Video:** "WaveWarZ Artist Interview: Kata7yst"  
- **URL:** `https://www.youtube.com/watch?v=ZU0ga5LRdyU`  
- **Channel:** WaveWarZ (official)  
- **Source:** YouTube oEmbed API — `author_name: "WaveWarZ"`, title confirmed  

Kata7yst is definitively a WaveWarZ artist. Their handle already appears in
`public/ww-battles.json` (2W 3L, 5 decided battles). This interview is the second
independent confirmation (on-chain record + official interview) and can be cited
in `Events.tsx` alongside the XTinct interview.

Cross-check against WinRateLeaderboard (wave 3): Kata7yst ranks 12th at 40.0% win rate
(2W 3L across 5 qualified battles) — consistent.

---

### 2. Crypto Magic Hour Ep. 50 — verified independent third-party coverage

- **Video:** "🪄 Crypto Magic Hour Ep. 50: WaveWarZ Epic Battle, New Crypto X Rules & More"  
- **URL:** `https://www.youtube.com/watch?v=rx0PeGv8lPI`  
- **Channel:** ⭕️VeVeMagic🏰 (independent crypto show host)  
- **Source:** YouTube oEmbed API — `author_name: "⭕️VeVeMagic🏰"`, title confirmed  

Third-party independent coverage of WaveWarZ — not by the WaveWarZ team. The title
indicates "WaveWarZ Epic Battle" as an episode topic. Upload date not obtainable via
oEmbed alone (prior search snippets suggested early March 2026). This is the first
confirmed external media coverage of WaveWarZ documented in this research log.

---

### 3. WaveWarZ Quick Battle / AMA programming — confirmed via wavewarz.info

Fetched `wavewarz.info` successfully this run. Confirmed:

- Quick Battles: **Mon–Fri at 8:30 PM EST** on X Spaces + YouTube (simultaneous)
- Community AMAs: **Mon–Fri at 11:00 AM EST** on X Spaces
- Tournament types: Artist Tournament (16-artist single-elim) + AI Artist Tournament

These are consistent with what `Events.tsx` and `docs/WAVEWARZ-RESEARCH.md` already
show. No correction needed.

---

## Still unverified

- **Wave Warz ZM / WaveWarZ Zambia** (`youtube.com/channel/UC4CTlM4Y6EZF0G9MBBAjwZQ`) —
  channel oembed returns 404; no specific video IDs known to cross-check. Remains an
  unverified regional-chapter lead. The channel name "Wave Warz Zm" with "Immersive
  Sound Recordings" branding could be a fan-run Zambian offshoot or an unrelated entity.
  Low confidence either way without a working video URL.
  
- **Instagram `instagram.com/wavewarz`** — 429 rate-limit this run. "Life of a Founder"
  series (Day 1/30 through Day 85) from prior search remains unverified.
  
- **Charity battle tweet exact text** — `x.com/WaveWarZ/status/1999858390567117201`
  returns 402 (auth required). The amounts in `Events.tsx` ($1,491 fiat, $1,497 total)
  are sourced from the existing research; the raw tweet remains unfetchable via this tool.

---

## Actions taken from this run

1. Added Kata7yst interview (`ZU0ga5LRdyU`) to `Events.tsx` WATCH (YOUTUBE) section.
2. Committed this verification doc.
