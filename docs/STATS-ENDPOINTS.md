# The two stats endpoints - which to use

wwtracker exposes two stats endpoints. They look similar and are not interchangeable.
Use the wrong one and you publish two-month-old numbers as if they were current.

## Use this for live numbers: `GET /api/ww/stats`

Live platform totals, cached from wavewarz.info's public API. One upstream call per
minute serves every consumer. Carries an explicit freshness contract:

- `status`: `live` | `stale` | `unknown`
- on `unknown`, `data` is `null` - render "unknown", never `0`

**If you are embedding WaveWarZ numbers on a page, this is the one.** Full contract in
[`PUBLIC-API.md`](./PUBLIC-API.md).

## Use this only for historical breakdowns: `GET /api/battles/stats`

**Not live.** Computed from a frozen battle snapshot (`public/ww-battles.json`) and clearly
marked so:

- `stale: true` - always, by design
- `asOf`: the snapshot's date, which is what the numbers reflect
- `liveTotals: "/api/ww/stats"` - the pointer to live data
- `computedAt`: when the response was assembled (not when the data is from)

It exists for the richer per-battle analytics the live endpoint does not compute: the
top battle by volume, the by-type breakdown, average volume per battle, and the date
range of the snapshot. Those need the full per-battle records, which only the snapshot
carries.

**Do not embed this as a live figure.** Its `total` will lag reality by however stale the
snapshot is. If you only want current totals, use `/api/ww/stats`.

## Why both exist

`/api/ww/stats` gives live aggregate totals but not per-battle detail. `/api/battles/stats`
gives per-battle detail but only over a frozen snapshot. They are complementary, not
redundant - but only one of them is live, and it says so in its own payload now.

## The rule, one line

Live number on a page -> `/api/ww/stats`. Historical breakdown -> `/api/battles/stats`,
and read its `asOf`.
