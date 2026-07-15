# WaveWarZ community research - run log

One line per hourly run: what was tried, and whether it worked or got stuck.

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
