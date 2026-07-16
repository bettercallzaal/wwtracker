# WaveWarZ community: social touchpoints survey

**Goal:** map where the WaveWarZ community actually shows up online (X, YouTube,
Instagram, Discord/Telegram, Reddit, Farcaster) as a first slice of community
research, distinct from the on-chain/team/Audius ground already covered in
`docs/WAVEWARZ-RESEARCH.md`.

## Environment constraint (read this first)

This run's sandbox has a strict outbound-network allowlist. Every `WebFetch`
call to an external page failed with `403 Forbidden` this run - including
control domains that are always reachable in a normal environment
(`https://example.com`, `https://en.wikipedia.org/...`). A raw `curl` to
`example.com` from this session also failed at the proxy layer
(`CONNECT tunnel failed, response 403`), while allowlisted hosts like
`registry.npmjs.org` and `raw.githubusercontent.com` returned `200`. So this
wasn't a wavewarz.com/X/YouTube-specific block - it's this session's egress
policy denying general web fetches outright. `WebSearch` (an Anthropic-hosted
service, not a raw fetch from this sandbox) still worked and is the only
source of information below.

Per the task's own verification bar ("every claim needs a real source URL you
actually fetched"), **nothing below has been fetched or verified** - it is all
search-snippet-derived and is marked Unverified accordingly. A future run
should re-check whether the egress policy allows direct fetches before
repeating this angle; if it does, re-fetch each URL below and promote what
holds up.

## Unverified / needs follow-up

All via `WebSearch` only, checked 2026-07-15 (UTC), no page fetched:

- **X account**: `x.com/WaveWarZ` appears active. A search-indexed post
  (`x.com/WaveWarZ/status/2038778781305868611`) reads "Yooooo we LIVE on the
  WaveWarZ YouTube for tonight's music x trading sesh" - suggests the nightly
  Quick Battle stream is cross-posted/announced on X. Another indexed post
  (`x.com/WaveWarZ/status/2031895742684479921`, snippet: "Here's where we at")
  links out but the link target wasn't resolved (fetch blocked).
- **YouTube**: `youtube.com/@WaveWarZ` runs an "Artist Interview" series -
  search results surfaced "WaveWarZ Artist Interview: XTinct" and "WaveWarZ
  Artist Interview: Kata7yst" as distinct uploads, plus a "WaveWarZ ZM RERUN"
  series (at least EP1 and EP2 indexed) and a short tagged
  `#founderlife #musiccommunity`. Upload dates, view counts, and full
  descriptions could not be confirmed (fetch blocked).
- **Instagram**: `instagram.com/wavewarz` appears to be running (or have run) a
  daily "Life of a Founder" content series - search hits for "Day 1/30" through
  "Day 28/30" posts tagged `#founder #founderlife`, plus a "Day 85... Building
  @wavewarz" reel. This reads as build-in-public content, plausibly from
  candy/Samantha Kinney (LinkedIn lists her as "Samantha Kinney - WaveWarZ" per
  the existing team research). Follower count, exact dates, and whether the
  series completed are unconfirmed.
- **Recurring community programming**: search snippets describe a nightly
  "Quick Battle Livestream" (trade the charts live while two songs battle) and
  weekday 11:00 AM EST X Spaces where "you can talk directly with the founders
  and give feedback." This is consistent with the AMA/programming times
  already noted in `docs/WAVEWARZ-RESEARCH.md` §1, but that prior note is
  itself sourced to wavewarz.info, which also could not be fetched this run to
  cross-check.
- **Discord / Telegram**: no WaveWarZ-specific server or channel found.
  Searches for `"WaveWarZ" "discord.gg"` and `"WaveWarZ" telegram` returned
  only unrelated "Wave"-branded results (Wave Esports, Wave Executor, Waves
  crypto news channels) - none referencing WaveWarZ itself.
- **Reddit**: no WaveWarZ-specific threads or subreddit surfaced.
- **Farcaster / Warpcast**: no WaveWarZ-specific channel or casts surfaced;
  results were generic "what is Farcaster" explainers.

## Verified

None this run - see the environment-constraint note above. Every candidate
fact above needs an actual page fetch to move to this section.

## Why this matters

If the YouTube "Artist Interview" roster (XTinct, Kata7yst, ...) and the
Audius-confirmed artist set in `docs/WAVEWARZ-RESEARCH.md` §6c (GodclouD,
BennyJ504WaveWarz, RoCkY2GriMeY, Hurric4n3Ike, NDA_WaveWarz) turn out to
overlap or diverge, that's directly relevant to `lib/leaderboard.ts` and the
recap pipeline (`scripts/recap/`, `docs/superpowers/specs/2026-07-14-recap-pipeline-design.md`)
- both currently reason about "who counts as a WaveWarZ artist" from on-chain
battle participation plus Audius handle-matching alone. A confirmed interview
series would be a second, independent signal for which artists the platform
itself is spotlighting, and could sanity-check or expand the roster the recap
drafts reference. Not actioned here since nothing above is verified yet.

## Next steps for a future run

1. Confirm whether the outbound-fetch block above is specific to this run or
   persistent across the hourly schedule; if a future run can fetch pages,
   prioritize re-fetching the URLs listed above over starting a new angle.
2. If fetches remain blocked, consider whether a different tool path (e.g. an
   MCP connector with its own network egress) can reach these specific pages,
   rather than repeating blocked WebFetch/curl attempts.
