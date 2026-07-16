# WaveWarZ community research: events/initiatives angle (blocked by tooling)

**Goal:** find verifiable info on WaveWarZ community-run initiatives, Discord/Telegram
presence, and AMA/Spaces content that isn't already covered by
`docs/WAVEWARZ-RESEARCH.md` (team, on-chain model, programming schedule, verified
artists).

## Environment blocker (read this first)

This run's `WebFetch` tool returned **HTTP 403 "gateway answered 403 to CONNECT
(policy denial or upstream failure)"** for every URL attempted, including
control checks against completely unrelated, uncontroversial domains
(`en.wikipedia.org`, `youtube.com`, `reddit.com`, `discord.com`). Raw `curl`
through the configured proxy hit the same `403` on `CONNECT`. Only the
`WebSearch` tool (which returns short snippets, not full page content) worked.

This means **no page could actually be fetched and read in full this run** -
only search-result snippets/titles were available. That fails this task's own
verification bar ("actually fetch pages, don't write from search-snippet
titles alone"), so nothing below is marked Verified. Everything is sourced to
a snippet only, explicitly flagged as fetch-unconfirmed.

If this persists across future hourly runs, the whole "community research"
mandate is blocked at the infrastructure level (network policy for this
environment appears to deny outbound `CONNECT` to arbitrary domains, with
`WebSearch` seemingly exempted as a hosted service). Widening the
environment's network policy to allow `x.com`, `wavewarz.com`, `wavewarz.info`,
`discord.com`, `youtube.com`, and `reddit.com` would unblock this.

## Findings (snippet-sourced only, NOT fetch-verified)

- A WaveWarZ charity battle ("Indies vs. Classics") apparently ran, raising
  reported funds for `@polyraiders` (girl-child education / Christmas gifts).
  Snippet claims ~$220 fiat matched by Nathan Hill/Liquid NFTs + ~0.14 SOL +
  1.5% of battle trading fees, total "$270+". Source (snippet only, page not
  fetched): [x.com/WaveWarZ/status/1999858390567117201](https://x.com/WaveWarZ/status/1999858390567117201)
  found via WebSearch on 2026-07-15. **Could not open the actual post to
  confirm wording, date, or numbers - do not treat as fact.**
- A YouTube video titled "WAVEWARZ COMMUNITY BATTLES" exists:
  [youtube.com/watch?v=TsP5k3OuNgE](https://www.youtube.com/watch?v=TsP5k3OuNgE) -
  title only, content not fetched/watched.
- A YouTube video "Crypto Magic Hour Ep. 50: WaveWarZ Epic Battle, New Crypto X
  Rules & More" exists: [youtube.com/watch?v=rx0PeGv8lPI](https://www.youtube.com/watch?v=rx0PeGv8lPI) -
  title only, content not fetched.
- `wavewarz.com/donate` appears to exist ("Support WaveWarZ Mainnet Launch")
  per search snippet - not fetched, content unknown.
- No public Discord or Telegram invite link for WaveWarZ surfaced in search
  results at all (searches for "WaveWarZ Discord community" and "WaveWarZ
  Telegram OR Discord invite link" returned only unrelated "Wave"-named
  servers for other projects/games). This is a negative result from search
  only, not a fetch-confirmed absence - WaveWarZ could have a community server
  that's simply not indexed or is invite-only/unlisted.
- No WaveWarZ-specific Farcaster/Warpcast presence surfaced in search.
- Searches for community sentiment, complaints, or praise about WaveWarZ
  returned zero relevant results - all hits were about an unrelated game
  ("Wuthering Waves", often abbreviated "WuWa") or other unrelated "Space
  Waves" products. No sentiment signal found either way.

## Verified

None. Nothing this run could be confirmed by actually opening a source page.

## Unverified / needs follow-up

- Charity battle claim (amounts, cause, date) - needs the actual X post or a
  recap page fetched and read.
- Whether WaveWarZ has any Discord/Telegram at all - needs a direct check of
  wavewarz.com/wavewarz.info's own links (currently unreachable) or asking the
  team directly, since search indexing gaps can't distinguish "no server" from
  "unlisted server."
- Content of any AMAs/Spaces - no episode content was accessible this run.
- **Whether `WebFetch` access is restorable for this environment** - this is
  the actual blocker for every future run of this research mandate, not a
  WaveWarZ-specific gap.

## Why this matters

None of this maps to a specific `lib/` module today (the app has no
community/social data path - see `docs/ARCHITECTURE.md` §2/§4, which lists
Dune + Audius as the only two live data sources). If the charity-battle claim
turns out to be real and fetchable, it would be a natural addition to
`components/Events.tsx` (section 09, currently static content) rather than
anything in the on-chain analytics pipeline. But that's speculative until a
future run can actually fetch and confirm it.
