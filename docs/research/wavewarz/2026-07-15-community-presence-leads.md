# WaveWarZ community presence — leads (unverified this run)

**Goal:** identify active/notable WaveWarZ community members, artists, and
community-run activity via X/Farcaster/Discord/Reddit/YouTube.

## What happened this run

`WebSearch` worked and surfaced several real-looking leads (search snippets
only). `WebFetch` and direct `curl` both failed on **every** URL attempted
tonight, including a control fetch of `https://example.com` — not just
WaveWarZ-related domains. `curl -v` showed the proxy CONNECT tunnel itself
returning `403` for `example.com` and `www.google.com`, while allow-listed
infra domains (`api.github.com`) succeeded. That confirms this session's
outbound web egress is scoped to an allowlist that excludes general web
browsing — it is not that WaveWarZ's community pages are blocking us
specifically.

Per this task's own verification bar ("every claim needs a real source URL
you actually fetched... don't write from search-snippet titles alone"), that
means **nothing below can be promoted to Verified this run.** Writing these
up as confirmed facts from search-result titles/snippets alone would violate
the one rule this task cares most about, so everything stays in the
Unverified bucket with the search query that surfaced it.

## Verified

None. No page fetches succeeded this run (see above).

## Unverified / needs follow-up

All of these come from `WebSearch` result titles/snippets only — no page was
actually opened and read, so treat names, dates, and claims below as leads,
not facts, until a future run can `WebFetch` them directly.

- **X account `@WaveWarZ`** (`https://x.com/WaveWarZ`) appears active, with
  post snippets referencing a "music x trading sesh" livestream and a link
  drop. Search surfaced status URLs
  `x.com/WaveWarZ/status/2038778781305868611`,
  `x.com/WaveWarZ/status/2031895742684479921`,
  `x.com/WaveWarZ/status/1965186766677442903` — dates unconfirmed (URL
  snowflake IDs suggest 2025–2026 range, not independently decoded).
- **Instagram `instagram.com/wavewarz`** — existence surfaced by search;
  bio/follower count not fetched.
- **YouTube channel `youtube.com/@WaveWarZ`** appears to run an "Artist
  Interview" series — titles found: "WaveWarZ Artist Interview: XTinct"
  (`youtube.com/watch?v=FmrzjYtdF6A`, XTinct is already a verified artist in
  `docs/WAVEWARZ-RESEARCH.md`) and a second, previously-undocumented one,
  **"WaveWarZ Artist Interview: Kata7yst"**
  (`youtube.com/watch?v=ZU0ga5LRdyU`) — could not fetch to confirm content,
  upload date, or that "Kata7yst" is a real WaveWarZ battler and not a
  mistitled/unrelated video.
- **Possible regional community spinoff — "WaveWarZ Zambia" / "WaveWarZ ZM".**
  A separate YouTube channel "Wave Warz Zm"
  (`youtube.com/channel/UC4CTlM4Y6EZF0G9MBBAjwZQ`) surfaced, search-snippet
  description "brought to you by Immersive Sound Recordings... Home of live
  music battles & vibes," with videos titled "WaveWarZ ZM RERUN EP1" and
  "THE @WaveWarZ ZM RERUN EP.2". This *could* be a community-run regional
  chapter/fan expansion of WaveWarZ in Zambia — or could be an unrelated
  "Wave Warz" using a similar name. Not fetched, not confirmed either way.
  Worth a dedicated follow-up run once fetching works, since a genuine
  community-run regional offshoot would be a notable finding.
- **Independent crypto-show coverage.** "Crypto Magic Hour Ep. 50: WaveWarZ
  Epic Battle, New Crypto X Rules & More" (`youtube.com/watch?v=rx0PeGv8lPI`),
  a show hosted by a account going by "VeVeMagic" — search results date this
  to roughly early March 2026, which if accurate would already be **>4
  months old (flagged stale)** relative to today (2026-07-15). Not fetched;
  content and date unconfirmed.
- No Discord or Telegram presence was found by search at all (as opposed to
  "found but unfetched" — targeted queries for `"WaveWarZ" Discord invite`
  and `"WaveWarZ" telegram t.me` returned zero WaveWarZ-specific hits, only
  unrelated "Wave"-named servers). Absence-of-evidence, not evidence of
  absence — a fetchable session could check the official site's own links
  for a Discord/Telegram invite directly.
- No Reddit presence found by search.

## Why this matters

The app has no community-facing surface today beyond the static links in
`AboutWaveWarZ.tsx` — if the Zambia-spinoff lead or the artist-interview
series turn out to be real and ongoing, they'd be candidates for the
`Ecosystem.tsx` / `Events.tsx` sections, and any newly-confirmed artist names
(e.g. Kata7yst) would need cross-checking against `lib/artists.ts` /
`lib/leaderboard.ts` before being added anywhere, per the existing rule in
`docs/WAVEWARZ-RESEARCH.md` §6c: never display an artist match that isn't
independently confirmed.

## Follow-up for next run

Re-run this same angle once `WebFetch`/outbound egress is available in the
session (confirm first with a control fetch like `https://example.com`
before spending time on WaveWarZ-specific URLs). Priority fetch list:
`x.com/WaveWarZ`, `youtube.com/@WaveWarZ`, `youtube.com/channel/UC4CTlM4Y6EZF0G9MBBAjwZQ`
("Wave Warz Zm"), `instagram.com/wavewarz`, and the official `wavewarz.com` /
`wavewarz.info` sites' own linked social/community URLs.
