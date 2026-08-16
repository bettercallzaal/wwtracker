# WaveWarZ ecosystem - live integrations

Platforms and projects currently connected to WaveWarZ. This lists **live** integrations
only - things that are shipped and public. Proposals and in-progress conversations are not
listed here.

| Integration | What it is | How it connects |
|---|---|---|
| **Audius** | Decentralized music streaming | Artists host tracks on Audius; any Audius track can be matched into a Quick Battle. This is the on-ramp - it is why battles can be automated without negotiating rights per track |
| **Ignite Radio / Harmony Hub** | Community radio and creator platform | Embedded on `wavewarz.info`; listeners can play WaveWarZ artists while reading the stats |
| **Solana** | The chain everything settles on | Battles, trades, artist payouts and trader claims all settle on Solana in seconds. Sub-cent fees are what make sub-dollar battles practical |
| **The ZAO** | The governing artist collective | WaveWarZ is The ZAO's flagship app; ZAO governance sets direction |

## For builders

WaveWarZ stats are embeddable. Rather than calling the upstream API directly, use the
cached, CORS-open endpoints documented in [`PUBLIC-API.md`](./PUBLIC-API.md) - one upstream
call per minute serves every embed, which keeps load off the origin. If you want to show
live WaveWarZ numbers on your own site, start there.

## A note on the on-ramp

Because artists reach WaveWarZ through Audius, anything that blocks Audius uploads blocks
WaveWarZ participation for that artist. If you are an artist who cannot upload to Audius
from your region, that is a known friction point being worked on - it is a reachability
issue, not a WaveWarZ restriction.
