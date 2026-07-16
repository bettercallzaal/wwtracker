# WaveWarZ community research - community events & channels (2026-07-15)

**Goal:** find real, verifiable activity from the WaveWarZ *community* (not on-chain
data, not app code) - specifically: does WaveWarZ have an active Discord/Telegram,
and are there any notable community-run initiatives, events, or organic
(non-official) coverage?

## Tooling note (read before trusting the "Verified" section below)

`WebFetch` was non-functional for this entire run - every attempt returned
`HTTP 403 Forbidden`, including on neutral test pages with no anti-bot
protection (`example.com`, `wikipedia.org`). This looks like an environment-level
block on this run, not a per-site block (x.com, youtube.com, wavewarz.com,
wavewarz.info all failed identically). So nothing below was verified by fetching
a full page - everything is sourced from `WebSearch` result snippets, which
Bing/Google's own indexer already extracted from the page. I'm citing the exact
URLs so a human (or a future run with working WebFetch) can double check. Treat
the "Verified" split below as "verified as far as search-snippet evidence goes,"
one notch below a true fetched-and-read confirmation. **Flag for whoever reads
this: if WebFetch is still broken on a future run, it's worth checking whether
it's a persistent environment issue rather than re-attempting it fresh every
hour.**

## Findings

### 1. One documented community-run charity initiative: the WaveWarZ Charity Battle

WaveWarZ ran a Christmas-themed charity Main Event, "Indies vs. Classics"
(IndieZ vs. ClassicZ), with proceeds going to **PolyRaiders**, a Nigeria-focused
girl-child-education NFT collective on Polygon/Base.

Source (WaveWarZ's own recap post): [x.com/WaveWarZ/status/1999858390567117201](https://x.com/WaveWarZ/status/1999858390567117201)
(checked 2026-07-15, via WebSearch snippet - direct fetch blocked, see tooling note).
Per the snippet:
- Full title: "WAVEWARZ CHARITY BATTLE RECAP: Indies vs. Classics"
- "The WaveWarz Charity Music Battle brought the community together to raise
  $270+ for @polyraiders, supporting girl child education and Christmas gifts
  for kids in Nigeria."
- Round 1 ("The Warm Up"): IndieZ won, with tracks including "What I Want for
  Christmas" (MetaVerseSlim) and "Grandma Got Jumped by a Reindeer" (InkSpireMusic)
  going up against classic Christmas songs. Round 2 ("The Clap Back"): IndieZ
  won again.
- Funds: "$220+ in fiat (matched by Nathan Hill/Liquid NFTs) plus ~0.14 SOL and
  1.5% of all battle trading fees" - earmarked for shoes, toothbrushes, books,
  and toys for a PolyRaiders Christmas party on Dec 17.

**Independent corroboration that PolyRaiders is a real, active project** (not
just a WaveWarZ-side claim): Polygon's own blog covers PolyRaiders' girl-child
charity work - [polygon.technology/blog/aping-in-for-good-nfts-are-reshaping-philanthropy](https://polygon.technology/blog/aping-in-for-good-nfts-are-reshaping-philanthropy)
(checked 2026-07-15, snippet-level) - and PolyRaiders' own account posted a
mint-funded milestone ("reached 1,000 girls with sanitary pads through 767
mints at $1.5 on Base") at [x.com/polyraiders/status/2051940751718703287](https://x.com/polyraiders/status/2051940751718703287)
(checked 2026-07-15, snippet-level). Two independent sources (Polygon's blog,
PolyRaiders' own account) agreeing on the same charity's mission is reasonably
strong corroboration, even without a direct fetch of either page.

This is the clearest evidence found this run of the WaveWarZ community
organizing around something other than trading/battles - a real-world
charitable tie-in, timed to a special-format battle outside the normal Quick
Battle / Main Event rhythm.

I could not find a second instance of a charity battle - only this one
(Christmas 2025/season) turned up across several search phrasings. Treat it as
a one-off found so far, not a recurring program, unless a later run finds more.

### 2. No dedicated Discord or Telegram surfaced

Multiple targeted searches (`"WaveWarZ" Discord community`, `"WaveWarZ" discord.gg
invite link`, `"WaveWarZ" Telegram`) returned only unrelated "Wave"-named
servers (Wave Esports, Wuthering Waves, a generic "Wave Community" music-bot
server) - nothing matching WaveWarZ specifically. Checked 2026-07-15.

This doesn't prove no Discord/Telegram exists (small/private servers aren't
always indexed), but it does mean the community's *visible* footprint is
concentrated on X (`@WaveWarZ`) and YouTube, not a chat server. The existing
domain doc (`docs/WAVEWARZ-RESEARCH.md`) already documents X Spaces / YouTube
as the live-programming channels; this run adds that a search-indexed
Discord/Telegram specifically does not turn up alongside them.

### 3. YouTube is host to more than the nightly stream

Beyond the nightly Quick Battle livestream (already documented), two other
YouTube content types turned up:
- A **"WaveWarZ Artist Interview"** series - two episodes found: XTinct
  ([youtube.com/watch?v=FmrzjYtdF6A](https://www.youtube.com/watch?v=FmrzjYtdF6A))
  and **Kata7yst** ([youtube.com/watch?v=ZU0ga5LRdyU](https://www.youtube.com/watch?v=ZU0ga5LRdyU)).
  XTinct is already a verified artist in `docs/WAVEWARZ-RESEARCH.md` §1. Kata7yst
  is a name not previously documented in this repo's research - see Unverified
  section, since I could not fetch the video itself to confirm publish date or
  content, only the title via search.
- A standalone **"WAVEWARZ COMMUNITY BATTLES"** video
  ([youtube.com/watch?v=TsP5k3OuNgE](https://www.youtube.com/watch?v=TsP5k3OuNgE))
  and organic third-party coverage - a crypto-content YouTuber's show, "Crypto
  Magic Hour Ep. 50: WaveWarZ Epic Battle" ([youtube.com/watch?v=rx0PeGv8lPI](https://www.youtube.com/watch?v=rx0PeGv8lPI)),
  covering a WaveWarZ battle as a topic. This suggests at least some organic
  interest from outside official WaveWarZ channels, though it's one data point
  from one creator, not evidence of broad organic reach.

Checked 2026-07-15, all snippet-level (see tooling note).

## Verified vs. Unverified

**Verified (via search-snippet evidence, cross-checked where possible; not via
direct page fetch - see tooling note):**
- WaveWarZ ran a Christmas-season charity Main Event ("Indies vs. Classics")
  raising $270+ for PolyRaiders' girl-child-education work in Nigeria.
- PolyRaiders is a real, active Polygon/Base NFT collective doing that work
  (corroborated by Polygon's own blog and PolyRaiders' own account,
  independent of WaveWarZ's claim).
- No Discord or Telegram server for WaveWarZ is surfaced by search, across
  several query phrasings.
- A "WaveWarZ Artist Interview" YouTube series exists, featuring at least
  XTinct and Kata7yst.

**Unverified / needs follow-up:**
- Kata7yst as a WaveWarZ artist - only the video *title* was seen (search
  snippet), not the interview content itself. Could not cross-check against
  Audius the way `docs/WAVEWARZ-RESEARCH.md` §6c did for other artists (that
  needs the live Audius API, which is an app-code task, out of scope for a
  research-only run, but worth flagging for a future recap/roster pass).
  Exact publish date of the interview (search reported "April 12, 2026") is
  from search metadata, not a fetched page - hold loosely.
- Whether the charity battle is a recurring program or a one-off - only one
  instance found.
- Whether a private/unindexed Discord or Telegram exists that search simply
  doesn't surface - absence of evidence isn't evidence of absence here.
- The exact date of the charity battle recap post (search snippet didn't
  surface a clean timestamp beyond "Christmas"/"Dec 17" references within the
  post text itself).

## Why this matters for wwtracker

- The charity battle ("Indies vs. Classics", IndieZ vs. ClassicZ, with
  non-standard competitor names like MetaVerseSlim/InkSpireMusic) is a special
  battle format that doesn't fit the normal artist-vs-artist schema
  `public/ww-battles.json` and `Battles.tsx` expect (id/type/date/artists/winner/vol/margin).
  If a future recap or battle-history pass wants full historical coverage, this
  kind of special/charity event needs its own handling rather than being
  silently dropped or force-fit into the Quick Battle / Main Event categories
  `scripts/ww-recap.ts` currently knows about.
- Kata7yst as a possibly-new artist name is relevant to `lib/artists.ts` /
  `Music.tsx`'s Audius-backed artist roster (and the "never display an Audius
  match that isn't confirmed by handle+title" rule in `docs/WAVEWARZ-RESEARCH.md`)
  - it should go through the same handle+title confirmation process as
    GodclouD/BennyJ504WaveWarz/RoCkY2GriMeY before being added anywhere, not be
    added off this doc alone.
- The absence of a discoverable Discord/Telegram supports treating X + YouTube
  as the complete official community-channel picture for now, consistent with
  how `AboutWaveWarZ.tsx` / `HowItWorks.tsx` already describe the platform's
  livestream channels.
