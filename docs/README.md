# WaveWarZ docs - start here

**Current state and roadmap: [AUDIT.md](AUDIT.md).** Moving work to production:
**[PORTING.md](PORTING.md)**. Read that first - it is
dated, every claim carries the command that produced it, and it says what to
work on next in priority order. Everything else here is reference.


A front door to the docs in this folder. If you are trying to understand WaveWarZ and
found conflicting information elsewhere, these are authoritative and dated.

## What is wwtracker

wwtracker is the ON-CHAIN BUSINESS LAYER for WaveWarZ. It is not a second leaderboard
or a backup battles table. wavewarz.info (their system of record) already has those.
What wwtracker covers, and what nothing else does, is the treasury wallet, the operating
floor, the fee model, the business ledger, and the program decoded instruction by
instruction. Everything battle-shaped, artist-shaped or song-shaped is read live from
wavewarz.info's public API or linked out to their pages, never copied.

## The map

- [**SURFACES.md**](./SURFACES.md) - the three WaveWarZ surfaces and who owns each. Read
  this first. WaveWarZ is not one site; it is three, with three owners.
- [**TEAM.md**](./TEAM.md) - who's who, and two names people routinely get wrong.
- [**ECOSYSTEM.md**](./ECOSYSTEM.md) - live integrations (Audius, Ignite Radio, Solana, The ZAO).

## For builders

- [**PUBLIC-API.md**](./PUBLIC-API.md) - cached, embeddable stats endpoints. Use these
  instead of hitting the upstream API directly.
- [**ARCHITECTURE.md**](./ARCHITECTURE.md) - how this tracker is built, data paths, the
  fee model, the sections, every metric's methodology.
- [**REFRESH.md**](./REFRESH.md) - which data is live, which is baked, and how to refresh
  the snapshots that haven't auto-updated.

## The live sources

- `wavewarz.info/api/public/stats` - the canonical battle count, volume, artist payouts,
  trader claims. Use these, not our copies.
- Dune Analytics - treasury wallet balance (live cached), program-wide on-chain activity
  (snapshots). Queries over Solana `solana.instruction_calls` and `solana.account_activity`.
- Solana RPC - fee wallet current balance, per-wallet on-chain state.

Numbers in snapshot files or dated recaps are historical - read them as of their date, not
as current.

## Research

[**WAVEWARZ-RESEARCH.md**](./WAVEWARZ-RESEARCH.md) and `research/` hold the deeper
background - tokenomics, event economics, community history.

## Operating procedures

- **[SOP.md](SOP.md)** - ending an unsettled battle, claiming, checking whether the volume bug is live, and the reporting rules this lane has paid for. Every procedure has been run on mainnet with the result recorded.
- **[upstream/api-audit-2026-09-20.md](upstream/api-audit-2026-09-20.md)** - the
  whole public API measured against chain: what is missing, the two `factors`
  schemas sharing one field name, and the five fixes that would help a consumer
  most.
- **[upstream/volume-field-2026-09-19.md](upstream/volume-field-2026-09-19.md)** -
  written for Candy: the volume field carrying the pool value, what is
  established, what is open, and the one question only her logs can answer.
- **[BRANCH-SCOPE-2026-09-20.md](BRANCH-SCOPE-2026-09-20.md)** - "update all to
  main", scoped: 191 branches carry commits main lacks, 121 of them need
  nothing, and the rest collapse into five decisions.
- **[BRANCH-AUDIT.md](BRANCH-AUDIT.md)** - what is on the 236 branches this repo
  has pushed, what never reached `main`, and the one test that tells those apart.
  45 components and four weekly recaps live only on unmerged branches, on
  purpose; one research document did not, and was rescued.
