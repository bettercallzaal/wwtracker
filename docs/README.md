# WaveWarZ docs - start here

A front door to the docs in this folder. If you are trying to understand WaveWarZ and
found conflicting information elsewhere, these are authoritative and dated.

## The map

- [**SURFACES.md**](./SURFACES.md) - the three WaveWarZ surfaces and who owns each. Read
  this first. WaveWarZ is not one site; it is three, with three owners.
- [**TEAM.md**](./TEAM.md) - who's who, and two names people routinely get wrong.
- [**ECOSYSTEM.md**](./ECOSYSTEM.md) - live integrations (Audius, Ignite Radio, Solana, The ZAO).

## For builders

- [**PUBLIC-API.md**](./PUBLIC-API.md) - cached, embeddable stats endpoints. Use these
  instead of hitting the upstream API directly.
- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - how this tracker is built.
- [**REFRESH.md**](./REFRESH.md) - how the baked data snapshots are regenerated.

## The one true number

Any live figure this tracker shows reads from `wavewarz.info`'s public API, cached through
`/api/ww/*`. The canonical battle count is `GET /api/ww/stats` -> `data.battles.total`.
Numbers in snapshot files or dated recaps are historical - read them as of their date, not
as current.

## Research

[**WAVEWARZ-RESEARCH.md**](./WAVEWARZ-RESEARCH.md) and `research/` hold the deeper
background - tokenomics, event economics, community history.
