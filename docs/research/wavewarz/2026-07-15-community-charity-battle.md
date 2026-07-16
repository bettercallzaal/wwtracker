# WaveWarZ community research: community-run initiatives (charity battle)

**Goal:** find and verify community-run initiatives or fan-driven activity around
WaveWarZ (not on-chain data, not app code) - one new angle not yet covered in
`docs/WAVEWARZ-RESEARCH.md`.

## Findings

### The WaveWarZ x PolyRaiders charity battle (Dec 2025)

WaveWarZ ran a themed charity edition of its battle format - "Indies vs.
Classics" (framed as **IndieZ** vs **ClassicZ**) - with trading fees and
donations directed to **PolyRaiders**, an NFT-funded girl-child-education
charity, ahead of a PolyRaiders Christmas party for kids.

- Recap post: [x.com/WaveWarZ/status/1999858390567117201](https://x.com/WaveWarZ/status/1999858390567117201)
  ("🎄 WAVEWARZ CHARITY BATTLE RECAP: Indies vs. Classics 🎄 ... brought the
  community together to raise $270+ for @polyraiders, supporting girl child
  education and Christmas gifts for kids...").
  - Tweet ID decodes (Twitter snowflake epoch) to **2025-12-13**, referencing a
    PolyRaiders Christmas party on **Dec 17**. Checked via web search 2026-07-15.
  - **This is >6 months old relative to today (2026-07-15) - flagging as
    possibly stale / not necessarily representative of current community
    activity.**
- Reported breakdown per the recap (as indexed by search, tweet not directly
  fetchable - see Verification note below): >$220 in fiat donations (matched by
  "Nathan Hill / Liquid NFTs"), plus ~0.14 SOL and 1.5% of all battle trading
  fees from that event, totaling "$270+". Funds earmarked for shoes,
  toothbrushes, books, and toys for the PolyRaiders Christmas party.
  IndieZ reportedly won the battle.
- PolyRaiders' own account shows it is an active NFT-for-good project distinct
  from WaveWarZ: [x.com/polyraiders/status/2051940751718703287](https://x.com/polyraiders/status/2051940751718703287)
  (2026-05-06, thanking minters for reaching "1,000 girls with sanitary pads
  through 767 mints ... on Base") - confirms PolyRaiders is a real, ongoing
  org, though this later post does not itself mention WaveWarZ.

### Artist interviews (community-facing content, not the on-chain roster)

WaveWarZ runs a YouTube "WaveWarZ Artist Interview" series, separate from the
battle streams themselves - a fan/community-facing format profiling battle
artists:
- "WaveWarZ Artist Interview: XTinct" - https://www.youtube.com/watch?v=FmrzjYtdF6A
- "WaveWarZ Artist Interview: Kata7yst" - https://www.youtube.com/watch?v=ZU0ga5LRdyU

XTinct is already a verified artist per `docs/WAVEWARZ-RESEARCH.md`. **Kata7yst
is a new name not present in the existing research doc or in
`lib/artists.ts`** - found via title/search only, video content not fetched
(see Verification note), so treat as an unverified lead, not a confirmed
roster addition.

### No Discord or Telegram found

Searched directly for a WaveWarZ Discord and Telegram; found none. This
matches the existing research doc, which documents live programming happening
on **X Spaces and YouTube**, not Discord - no contradicting evidence turned up.
Also found no WaveWarZ presence on Reddit or Farcaster/Warpcast in search.

## Verification note (tooling limitation)

`WebFetch` returned HTTP 403 for every URL attempted this run, including
control URLs unrelated to WaveWarZ (e.g. `https://example.com`), and multiple
X mirrors (`xcancel.com`, `fxtwitter.com`) and `wavewarz.com`/`wavewarz.info`
directly - this looks like a tool-level or network-level block for this run,
not a site-specific one. All findings above are therefore sourced from
`WebSearch` result content (which in most cases included substantial verbatim
quoted tweet text, not just titles) rather than a direct page fetch. Treat the
charity-battle dollar/SOL breakdown as **reported-by-search-snippet,
unconfirmed by direct fetch** until a future run can re-verify by opening the
tweet directly.

## Verified vs Unverified

**Verified (via WebSearch, cross-referenced across multiple queries, dated):**
- WaveWarZ ran a charity-themed battle in Dec 2025 tied to PolyRaiders, with
  proceeds (~$270+) benefiting a children's charity event - corroborated by
  both the WaveWarZ recap tweet and PolyRaiders' own separate, later account
  activity confirming PolyRaiders is a real, active org.
- No Discord/Telegram community found for WaveWarZ; X + YouTube remain the
  visible community surfaces.
- A "WaveWarZ Artist Interview" YouTube series exists, featuring at least
  XTinct (already verified) and Kata7yst (name only, see below).

**Unverified / needs follow-up:**
- Exact wording and full content of the charity-battle recap tweet (WebFetch
  blocked this run - snippet-only).
- Whether Kata7yst is a confirmed WaveWarZ battle artist (matches app roster
  criteria) - interview title only, video not watched, no cross-check against
  `lib/artists.ts` roster data.
- Whether the WaveWarZ x PolyRaiders charity battle was a one-off or recurs
  (no other charity-battle mentions found in this run's searches).
- Current (2026) community sentiment, size, or any post-Dec-2025 community
  initiatives - this run did not turn up anything more recent than the
  charity battle for the "community-run initiatives" angle specifically.

## Why this matters for wwtracker

- `docs/WAVEWARZ-RESEARCH.md` section 1 already notes WaveWarZ has "no
  platform token" and settles everything in SOL - this charity battle is a
  concrete example of that mechanic being used for a stated social-good
  purpose (fee-routing to a cause) beyond ordinary trading, which the current
  app doesn't surface anywhere (Events.tsx / Ecosystem.tsx have no charity/cause
  content).
- If Kata7yst turns out to be a real, verifiable battle artist, that's a
  roster lead for `lib/artists.ts` / `lib/songs.ts` (Music tab), following the
  existing "never display an Audius match that isn't confirmed by
  handle+title" rule in the research doc.
