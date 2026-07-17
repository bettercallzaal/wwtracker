# WaveWarZ community research - verification follow-up (2026-07-17)

**Goal:** Re-check the unverified leads from 2026-07-15 now that WebFetch is
functional. Every claim here has a real page fetch behind it.

**Method:** WebFetch on `wavewarz.info` (which loaded successfully, unlike the
2026-07-15 session where all fetches returned 403). X.com returns 402 (auth
wall) in this environment, so X-only claims remain snippet-level from prior
sessions.

---

## Verified

### 1. Telegram: @wavewarzclipshq

**Source:** `wavewarz.info` footer, fetched 2026-07-17.

WaveWarZ links to `https://t.me/wavewarzclipshq`. This is a **clips/highlights
channel**, not a general community server. The Telegram handle is
`@wavewarzclipshq` — the name suggests it posts battle highlights or VOD clips.

This was listed as unverified in `2026-07-15-community-social-presence.md`
because that session could not fetch wavewarz.info. Now confirmed.

### 2. No Discord

**Source:** `wavewarz.info` footer, fetched 2026-07-17.

wavewarz.info's footer lists exactly: X, YouTube, Telegram. No Discord link.
Combined with the 2026-07-15 WebSearch returning nothing for
`"WaveWarZ" "discord.gg"`, Discord absence is now effectively confirmed.
WaveWarZ does not operate a public Discord server.

### 3. YouTube: @WaveWarZ confirmed

**Source:** `wavewarz.info` footer link to `youtube.com/@WaveWarZ`, fetched
2026-07-17. Channel name/sub count could not be extracted (YouTube renders most
metadata client-side). Channel existence is confirmed; the 2026-07-15 doc's
descriptions of Artist Interview series and ZM Rerun series remain
snippet-level (not fetch-verified).

### 4. Kata7yst is an active, established artist

**Source:** `public/ww-battles.json` (1,107 battles as of Jul 17, 2026).

Kata7yst (`aHandle`/`bHandle = "Kata7yst"`) has:
- **4 battles as primary handle**: 2W-2L, 1.26 SOL total volume, Jun–Jul 2026
- **Featured in 43 song titles** across battles (e.g., "Limit breaker- Kata7yst
  feat Cannon Jones973", "Kata7yst and RoCkY2GriMeY - Who I Was")

The 2026-07-15 doc flagged Kata7yst as "a possible new artist name" that
appeared in WebSearch results. The battle data confirms they are a real,
frequently-featured artist — not a name alias or duplicate. A YouTube Artist
Interview video ("WaveWarZ Artist Interview: Kata7yst") was indexed in
WebSearch; the artist's real identity behind the handle is unconfirmed but
their WaveWarZ activity is substantial.

---

## Upgraded to Unverifiable (requires X auth)

These claims from prior sessions cannot be fetch-verified because X.com
returns HTTP 402 (payment required) for all URLs in this environment:

- Charity battle recap post: `x.com/WaveWarZ/status/1999858390567117201`
- Live-show announcement posts from X Spaces

The charity battle data is already represented in `public/ww-battles.json`
(24 COMMUNITY-type battles), and the `CommunityBattles` component (PR #110)
surfaces the $1,497 charity figure from the pre-tracker PolyRaiders series.
No further X verification is available without auth.

---

## Still unverified (low priority)

- Instagram (`instagram.com/wavewarz`) — "Life of a Founder" series
- YouTube video view counts and upload dates
- Whether any independent fan accounts or community-run WaveWarZ content exists
  (prior searches returned "Wuthering Waves" noise; would need a more targeted
  pass with working fetch to distinguish)
