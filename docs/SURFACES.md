# WaveWarZ surfaces - who owns what

WaveWarZ is three surfaces with three different owners. This is the map. If you are
new here, or you found conflicting information elsewhere, this is authoritative.

Last verified with live checks: 2026-08-14.

| Surface | Owner | What it is | Repo |
|---|---|---|---|
| **wavewarz.com** | Hurricane | The dapp. Live-traded music battles - trade the charts while the music plays | private |
| **wavewarz.info** | Candy (CandyToyBox) | WaveWarZ Intelligence: analytics, leaderboards, brackets, and the **public API** | separate |
| **wwtracker.vercel.app** | Zaal | This repo. A separate analytics dashboard and a cached fan-out layer over the public API | this repo |

## Why three

They are additive, not competing:

- **wavewarz.com** is where battles happen and trade.
- **wavewarz.info** is the intelligence layer and the source of truth for battle data,
  via its public API.
- **wwtracker** is analytics plus a caching layer, so third parties can embed WaveWarZ
  stats without every site hitting the origin directly (see `PUBLIC-API.md`).

## The public API

The canonical data source is `wavewarz.info`'s public API - no key, CORS open. Everything
in this repo that shows a live number reads from it, directly or through the cached routes
in `/api/ww/*`. See [`PUBLIC-API.md`](./PUBLIC-API.md).

**The one true battle count** is `GET /api/ww/stats` -> `data.battles.total`. Any battle
count in a snapshot file (`public/ww-battles.json`, `lib/battles.ts`) or a dated recap is
a historical snapshot and should be read as of its date, not as current.

## Governance

WaveWarZ operates under **The ZAO**, a decentralized artist collective that runs weekly
Fractal governance on Optimism. That governance layer - artists who earn Respect and vote
on direction - is what distinguishes WaveWarZ from a purely corporate battle platform.
