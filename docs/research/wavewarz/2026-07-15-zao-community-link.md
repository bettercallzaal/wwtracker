# WaveWarZ community research — the ZAO connection

**Goal:** Identify who/what the WaveWarZ *community* actually is (not on-chain
activity), since no dedicated community doc existed yet in this repo.

## Environment note (read this first)

`WebFetch` in this research environment returned `HTTP 403 Forbidden` for
**every non-GitHub URL tried** — including `example.com` and
`en.wikipedia.org` as controls, not just WaveWarZ-adjacent sites (`x.com`,
`youtube.com`, `t.me`, `pods.media`, `thezao.com`, `thezao.xyz`,
`wavewarz.com`, `wavewarz.info`, `zaofestivals.com`, `farcaster.xyz`). Only
`github.com` blob/repo URLs fetched successfully. So: X/Discord/Telegram/
YouTube/Farcaster activity below is **search-snippet-only** (titles +
descriptions surfaced by `WebSearch`, not the actual page content) and is
marked Unverified. Only the two GitHub fetches below are treated as Verified.
**Next run: check first whether WebFetch access has improved before repeating
these searches.**

## Verified (actually fetched, with URL + date checked)

- **WaveWarZ isn't a standalone project — it's built inside The ZAO's
  ecosystem.** [`bettercallzaal/ZAOOS` README](https://github.com/bettercallzaal/ZAOOS/blob/main/README.md)
  (fetched 2026-07-15) describes The ZAO as "a decentralized music community
  of 188 members on Base," governed by ORDAO (on-chain reputation DAO), with
  a three-tier governance model (ZOUNZ on-chain proposals via Nouns Builder
  Governor on Base, weekly Snapshot polls, and Supabase-tracked community
  proposals with 7-day respect-weighted voting).
- **ZAOOS (a separate, sibling repo to this one) has its own WaveWarZ
  integration**, built independently of wwtracker: [`bettercallzaal/ZAOOS`
  repo listing](https://github.com/bettercallzaal/ZAOOS) (fetched
  2026-07-15) shows `src/app/(auth)/wavewarz/page.tsx`, `src/app/api/wavewarz/`
  (sync/artists/random-stat endpoints), `src/lib/wavewarz/` (scraper,
  constants, random-stats, proposals), and `src/components/wavewarz/`
  (`GeneratePostButton`). Per the same fetch, it tracks a **43-artist
  roster** with win/volume stats via nightly syncs and auto-generates DAO
  proposal drafts from battle milestones, with a button to share battle
  stats to Farcaster.
  - Note on staleness: the repo-listing fetch surfaced a "last updated June
    10, 2026" census snapshot and a "v1.2.0 (March 14, 2026)" release note
    embedded in that page's own content — both are within 6 months of today
    (2026-07-15), so not flagged stale, but they're self-reported by the repo
    page rather than independently cross-checked against `git log`.

## Unverified / needs follow-up (search snippets only — pages themselves 403'd)

- **The repo owner's own social footprint overlaps directly with WaveWarZ's
  community.** Search snippets surface `+Zaal (on farcaster) (@bettercallzaal)`
  on X, and a weekly livestream **"Let's Talk About Web3"** co-hosted by EZ,
  Ohnahji, and BetterCallZaal, airing on `twitch.tv/bettercallzaal`,
  `twitch.tv/ohnahji`, `twitch.tv/ezincrypto`, with a community hub at
  `ltaw3.thezao.com`. Episode 5 reportedly "celebrated the release of
  WaveWarZ." Source: WebSearch results for `"Let's Talk About Web3" WaveWarZ
  EZ BetterCallZaal` (checked 2026-07-15) — pages themselves
  (`pods.media/lets-talk-about-web3/...`) returned 403 on fetch, so episode
  dates/content are not independently confirmed.
- **A YouTube artist interview and a battle-recap episode exist**: "WaveWarZ
  Artist Interview: XTinct" and "Crypto Magic Hour Ep. 50: WaveWarZ Epic
  Battle, New Crypto X Rules & More" turned up by title in search results.
  Neither `youtube.com` page could be fetched (403), so publish dates, view
  counts, and actual content are unconfirmed.
- **No dedicated WaveWarZ Discord or Telegram found.** Targeted searches for
  `"WaveWarZ Discord community"` and `"WaveWarZ" telegram` returned only
  unrelated "Wave"-branded servers/channels (Wave Esports, Wave Music bot,
  `@Wavescommunity`, `@wavesnews` — none WaveWarZ-specific). This suggests
  WaveWarZ community coordination happens through The ZAO's existing
  Farcaster/Discord infrastructure rather than a standalone server, but that
  inference isn't confirmed — it's possible a channel exists that just didn't
  surface in search.
- **ZAO-CHELLA** (`zaofestivals.com`) appears in search results as a ZAO
  community festival; unclear if/how WaveWarZ battles factor into it — page
  403'd on fetch, not confirmed.
- **A Farcaster channel presence** (`/zao`, and possibly `/onchain-music`) is
  referenced in search snippets as where ZAO organizes community discussion,
  but channel member counts and actual WaveWarZ-specific posts could not be
  fetched or confirmed.

## Why this matters for wwtracker

- `components/Ecosystem.tsx` (section 09) already gestures at "ZAO ecosystem
  context" per `docs/ARCHITECTURE.md` §4 — this run gives it a concretely
  sourced anchor (the 188-member, ORDAO-governed ZAO) instead of a vague
  reference, if that section wants a "who's behind this" blurb.
  `docs/WAVEWARZ-RESEARCH.md` currently only lists `x.com/WaveWarZ` and
  `youtube.com/@WaveWarZ` as links (line 233) with no mention of The ZAO
  parent community at all — worth adding a line there.
  Speculative, flag before acting on it: **ZAOOS's independent 43-artist
  roster + nightly-sync approach (`src/lib/wavewarz/scraper`) is a second,
  parallel data source to wwtracker's own `public/ww-battles.json` /
  `scripts/ww-battles-fetch.ts` pipeline** — if it's still actively
  maintained, it could be worth comparing artist counts/coverage against
  `lib/leaderboard.ts` for gaps, but this needs a maintainer decision, not an
  autonomous change, since it's a different repo built by the same person for
  a possibly different purpose.
- The "no dedicated WaveWarZ Discord/Telegram found" result is itself useful
  signal for anyone deciding whether to build community features (e.g. a
  Discord bot showing live battle odds) — there may not be an existing
  community channel to hook into beyond ZAO's general infrastructure.

## Bottom line

WaveWarZ's community is genuinely hard to pin down as an independent entity
in this environment's fetch-restricted conditions — most of what surfaces is
that it's a project *of* The ZAO (a verifiably real, GitHub-documented
188-member on-chain music DAO) rather than a project with its own separate
fanbase/Discord. That's a real, if modest, finding — not padding it further
with unverifiable YouTube/X claims.
