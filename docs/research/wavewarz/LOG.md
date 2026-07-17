# WaveWarZ community research log

One line per hourly run: what was tried, and whether it worked or got stuck.

2026-07-16 (this run) - WebFetch operational; fetched wavewarz.info/events (confirmed two-part charity series: Holiday Heat Dec 2024 ~$270 + Love Song Benefit Feb 2025 ~$1,221, total ~$1,497 for PolyRaiders/HuRya), fetched ZAOOS README (confirmed Farcaster integration via /zao channel + GeneratePostButton), fetched wavewarz.info for DJ Wavy (confirmed 2-of-3 poll+charts+AI mechanism, Quick Battle nightly format), fetched ZAO-CHELLA page (confirmed WaveWarZ LIVE at Art Basel Dec 2024). x.com tweets still 402-gated, farcaster.xyz channel pages JS-gated. Wrote 2026-07-16-community-verified-and-farcaster.md. Key new finding: charity battle is a TWO-event series (not one), combined total $1,497; date discrepancy between events page (Dec 12 2024) and tweet snowflake (Dec 13 2025) flagged unresolved. Nathan Hill/Liquid NFTs donor match not confirmed on any fetched page. No /wavewarz Farcaster channel found; Farcaster is a ZAO/ZAOOS layer feature, not in wwtracker app.

2026-07-15 09:05 UTC - Tried community events/charity-initiatives/Discord-Telegram angle via WebSearch+WebFetch - stuck-because-WebFetch returned 403 on every URL this run (including unrelated control domains like en.wikipedia.org), so no page could be fetched/verified; only WebSearch snippets were available. Wrote up snippet-only leads under Unverified and flagged the tooling outage as the real blocker for future runs.

# WaveWarZ community research - run log


2026-07-15 08:00 UTC - First run. Oriented on docs/ARCHITECTURE.md +
docs/WAVEWARZ-RESEARCH.md (no prior docs/research/wavewarz/ existed - created
it). Picked "community events & channels" (charity battles, Discord/Telegram
presence, artist interview series, organic third-party coverage) since it
wasn't covered by the existing domain-research doc. WebFetch was fully broken
this run (403 on every URL including neutral test pages) - relied on WebSearch
snippets only, flagged clearly in the doc; worth checking if WebFetch is back
up on the next run before assuming the same workaround is needed. Worked -
found one concrete, cross-corroborated finding (the PolyRaiders charity battle)
plus a couple of leads (Kata7yst as a possibly-new artist name, no
Discord/Telegram surfaced). Wrote
docs/research/wavewarz/2026-07-15-community-events-and-channels.md.

Remaining community angles not yet covered (for future runs): sentiment /
recurring complaints or praise about specific battles; how community members
talk about DJ Wavy (the AI judge) specifically; whether the Community AMAs
(Mon-Fri ~11am EST, per docs/WAVEWARZ-RESEARCH.md) have any searchable
recap/content; artist-roster growth/churn over a longer window (needs a wider
artist-name sweep, ideally with working WebFetch to actually read bios);
fan-made content (memes, remixes, fan accounts) - initial search here mostly
surfaced unrelated "Wuthering Waves" fan content, needs a more targeted pass.


2026-07-15 06:05 UTC - researched community-run initiatives angle (WaveWarZ x PolyRaiders charity battle, Dec 2025; checked for Discord/Telegram/Reddit/Farcaster presence; noted "Kata7yst" artist-interview lead) - worked, but WebFetch was blocked (403) for every URL this run including control URLs, so findings are WebSearch-snippet-sourced rather than direct-fetch-verified; flagged in the doc. Remaining open community angles for future runs: active/notable community members roster, sentiment/complaints/praise, artist roster growth over time, AMA/Spaces content specifics, fan content/community-run content beyond the one charity battle found.



2026-07-15 07:06 UTC - researched the WaveWarZ/ZAO community link (who's behind it, Discord/Telegram/Farcaster presence) - worked for the ZAO-connection angle via GitHub-fetchable sources, but stuck-because WebFetch returned 403 on every non-GitHub URL tried (including control URLs like example.com/wikipedia), so X/YouTube/Telegram/pods.media/thezao.com claims are search-snippet-only and marked Unverified. Next run should re-check whether WebFetch access to general web domains has changed before repeating these searches, and/or try a different remaining angle (community sentiment/complaints, artist roster growth over time, AMA/Spaces content) with the same caveat in mind.

- 2026-07-15 05:06 UTC - Tried to map WaveWarZ community touchpoints (X, YouTube, Instagram, Discord, Telegram, Reddit, Farcaster) via WebSearch, planning to fetch and verify each page - stuck-because this session's WebFetch/curl egress is blocked entirely by the sandbox's network policy (403 even on control domains like example.com and wikipedia.org; only allowlisted hosts like registry.npmjs.org work). Wrote `2026-07-15-community-social-presence.md` with everything under Unverified since nothing could be fetched. Next run: check if egress is unblocked before repeating this angle; if still blocked, pick a different angle or tool path rather than re-attempting the same fetches.

One line per hourly run: what was tried, and whether it worked.

- 2026-07-15 (this run, exact time unavailable in-session) - Tried community
  angle "active/notable community members and artists" via WebSearch. Stuck
  because: WebFetch and direct curl both failed on every URL this run,
  including a control fetch of example.com (proxy CONNECT tunnel returned
  403 for non-allowlisted hosts) - outbound web egress is scoped to an
  allowlist that excludes general web browsing this session, not a
  WaveWarZ-specific block. Wrote up WebSearch-only leads (X/Instagram/YouTube
  presence, a possible "WaveWarZ Zambia" regional spinoff, an independent
  crypto-show mention, no Discord/Telegram/Reddit found) as explicitly
  Unverified in `2026-07-15-community-presence-leads.md` per the
  no-snippets-only verification rule. Next run: confirm WebFetch works
  (control-fetch example.com first) before re-attempting; if it does,
  prioritize fetching the leads listed in that doc's Follow-up section.


One line per hourly run: what was tried, and whether it produced a doc or got stuck.

- 2026-07-15 03:05 UTC - Oriented (read docs/ARCHITECTURE.md + docs/WAVEWARZ-RESEARCH.md, confirmed docs/research/wavewarz/ didn't exist yet, no prior branches/PRs under research/wavewarz-*). Picked angle: community-run initiatives / charity events (WebSearch surfaced a "WaveWarZ Charity Battle" recap post - IndieZ vs ClassicZ, ~$270 raised for @polyraiders, girl-child education + Christmas gifts, matched by a "Nathan Hill/Liquid NFTs" donor - x.com/WaveWarZ/status/1999858390567117201). Tried to verify via WebFetch (the tweet, nitter.net, wavewarz.com/donate, wavewarz.info) and via direct curl - **stuck-because-network**: every outbound HTTPS request from this session (including unrelated control hosts like wikipedia.org and example.com) got `403 CONNECT tunnel failed` at the egress proxy (`gateway answered 403 to CONNECT (policy denial or upstream failure)` per `/__agentproxy/status`). This is a session-wide block, not a per-site bot-block, so no claim could be fetch-verified this run. WebSearch itself still works and returned real snippet text (not just titles), but the run's verification bar requires an actual page fetch, which was unavailable. No findings doc was written to avoid stating anything as "verified" that wasn't. **Next run: retry WebFetch/curl first - if the network is back, verify the charity-battle post above (date, exact figures, @polyraiders identity) and write it up as the community-initiatives doc. If still blocked, try a different fetch path (e.g. GitHub MCP tools, which use a separate auth path) or flag to the user that this environment cannot do outbound web research at all.**
