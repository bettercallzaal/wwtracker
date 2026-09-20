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

## Origin, and who it answers to now

**WaveWarZ does not operate under The ZAO.** It was **incubated in The ZAO by three ZAO
members** and has since **graduated into its own project and ecosystem**. Corrected
2026-09-20 by Zaal; this section previously said WaveWarZ "operates under The ZAO" and
pointed at weekly Fractal governance as the thing that distinguishes it. That was true of
its origin and is not true of its governance.

The relationship that remains is history plus whatever integrations exist on their own
merits, not authority. **Anything describing The ZAO as governing WaveWarZ, voting on its
direction, or owning it is wrong.** `components/Ecosystem.tsx` already had this right -
it calls The ZAO "the DAO that incubated WaveWarZ" - and that is the phrasing to copy.
