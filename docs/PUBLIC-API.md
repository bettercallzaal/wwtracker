# wwtracker public API - embed WaveWarZ stats on your site

Cached, CORS-open endpoints for showing live WaveWarZ numbers on your own pages.

**Base:** `https://wwtracker.vercel.app/api/ww`

---

## Why use this instead of calling wavewarz.info directly

`wavewarz.info` publishes an open API with no key and no enforced rate limit. It is
genuinely open, and it is also **someone else's server**.

If five partner sites embed live stats and each calls the origin directly, that origin
takes the combined traffic of all five audiences, forever, without anyone having agreed
to it.

These endpoints make one upstream call per minute and serve everybody from the result.
Ten viewers or ten thousand, the origin sees the same load.

If you are building an embed, **please use these**. If you need something they do not
expose, open an issue rather than pointing your site at the origin.

---

## Endpoints

### `GET /api/ww/stats`

Platform totals: volume, artist payouts, trader claims, battle counts, SOL price.

```bash
curl https://wwtracker.vercel.app/api/ww/stats
```

### `GET /api/ww/leaderboards/{kind}?limit=100`

`kind` is one of `artists`, `traders`, `songs`. `limit` is clamped to 1-500; anything
unparseable falls back to 100. Any other `kind` returns 404.

```bash
curl "https://wwtracker.vercel.app/api/ww/leaderboards/songs?limit=10"
```

> **Read the trader-leaderboard warning below before you render `traders`.** Its
> P&L and win-rate fields are computed from an incomplete table and we have
> measured how incomplete.

### `GET /api/ww/battle`

The current or most recent battle: both sides, their pools, the poll, the DJ Wavy
call, and whether it has settled.

```bash
curl https://wwtracker.vercel.app/api/ww/battle
```

`data` carries `id`, `type`, `url`, `live`, `settled`, `endsAt`, `winnerSide`,
`poll`, `djWavy`, and `a` / `b`, each of which is `{ artist, track, art, poolSol }`.
Note `artist` and `track` are separate fields here - upstream's own
`artist1.name` is the *track* title, which has caused real bugs.

### `GET /api/ww/positions?battleId=<id>`

**This one is not a proxy.** It reads Solana directly, because the holder set is
not something the public API exposes: both mints are PDAs derived from the battle
id, so who holds what is readable by anyone and is not currently read by anything
else. Omit `battleId` and it resolves the current battle.

```bash
curl "https://wwtracker.vercel.app/api/ww/positions?battleId=1788580997"
```

`data` carries the battle (`battleId`, `running`, `settled`, `startTime`,
`endTime`, `creator`, `artistAWallet`, `artistBWallet`), the money (`poolASol`,
`poolBSol`, `potSol`, `supplyA`, `supplyB`, `heldA`, `heldB`,
`totalDistributionSol`), the implied payouts (`impliedIfAWins`, `impliedIfBWins`,
`multipleIfAWins`, `multipleIfBWins`, `marketWinnerIsA`), and `holdersA` /
`holdersB` - each holder being `{ owner, amount, share, sol }`, ranked.

#### `truncatedA` / `truncatedB` - read these before you do arithmetic on holders

`getTokenLargestAccounts` returns **at most 20 accounts** and says nothing about
having been cut short. A side with 34 holders and a side with 20 come back
identically.

So when `truncatedA` is true, `holdersA` is the twenty largest and `heldA` is
their sum, **not** the side's total held supply. In particular:

    supplyA - heldA   is the burned-at-claim amount ONLY when truncatedA is false

Treat a truncated side as "at least this many holders, at least this much held".
Do not derive a claimed-and-burned percentage from it, and do not present the
holder count as a total.

Measured across every battle in the platform's history - 1,643 battles, 15,359
trades - the most holders any side has ever ended with is **18**, so the flag has
never yet been true. It is published because the first battle large enough to
trip it will be the first one anybody is watching live.

---

## The response shape, and the one rule

Every response looks like this:

```json
{
  "status": "live",
  "fetchedAt": "2026-08-13T08:39:41.572Z",
  "ageSeconds": 0,
  "data": { "...": "upstream payload, unchanged" },
  "source": "wavewarz.info"
}
```

`status` is the field that matters:

| status | Meaning | `data` |
|---|---|---|
| `live` | Current data | The payload |
| `stale` | Upstream is unreachable; this is the last good response. `ageSeconds` says how old | The payload |
| `unknown` | No good response has ever been seen | **`null`** |

### **Render `unknown` as "unknown". Never as 0.**

This is the whole reason the wrapper exists. A dashboard showing "0 battles" because an
API call failed is not a degraded dashboard, it is a wrong one - and a viewer cannot tell
the difference.

On `unknown`, `data` is `null` rather than a zero-filled object, so a naive
`data.battles.total` throws rather than quietly rendering `0`.

```js
const r = await fetch("https://wwtracker.vercel.app/api/ww/stats").then((r) => r.json());

if (r.status === "unknown") {
  el.textContent = "unknown";              // correct
} else {
  el.textContent = r.data.battles.total;   // safe on live and stale
  if (r.status === "stale") {
    el.title = `as of ${Math.round(r.ageSeconds / 60)} min ago`;
  }
}
```

A `stale` response is still worth showing - a number from four minutes ago is useful,
and `ageSeconds` lets you say so.

---

## Notes

- **Always HTTP 200**, even for `stale` and `unknown`. The request succeeded; the payload
  carries the truth. A 5xx would push you into an error path, which is exactly where a
  zero tends to get rendered.
- **`X-WW-Status`** repeats the status as a header, if that is easier to route on.
- **CORS is open.** Any origin, `GET` and `OPTIONS`.
- **Cache headers** allow CDN and browser caching (`s-maxage=60`,
  `stale-while-revalidate=300`). `unknown` is sent `no-store` so it cannot get pinned
  after upstream recovers.
- **Do not poll faster than once a minute.** You will get the same bytes - the upstream
  itself only refreshes every 30-60 seconds.
- **`data` is the upstream payload, unmodified.** No renaming, no reshaping. If upstream
  changes shape, you see that change. Note that the three leaderboard endpoints wrap
  their rows in an object (`{ updatedAt, count, artists }`), rather than returning a bare
  array.
- **`fetchedAt` on a `live` response is a serve time**, not proof of an upstream call -
  the body may have come from cache. For upstream freshness read `data.updatedAt`. On a
  `stale` response, `fetchedAt` is exactly when the last good body was stored.

## The trader leaderboard disagrees with chain, and by a lot

If you render `leaderboards/traders`, read this first.

`data` is the upstream payload unmodified, which is the contract and is not going
to change. But the trader rows were measured against a complete scan of every
trade in the platform's history - 1,643 battles, 15,359 trades, read from Solana
- on 2026-09-07, and they do not agree:

| | Wallets | Aggregate trader P&L |
|---|---|---|
| this endpoint | 145 | **+204.29 SOL** |
| chain | 157 | **-17.08 SOL** |

Traders in aggregate must be down by roughly the fees taken out of them, which is
what a fee is. The platform's arithmetic is correct - `payout - invested` is the
right formula. The `trades` table underneath it is short: buys are 42.7% present
by value and sells 46.5%, because hydration fetches a battle's whole trade
history and skips the write on failure, so the biggest battles are lost first.

**What that means for a row you are about to render.** Every one of these fields
comes off those same short rows: `netPnlSol`, `netPnlUsd`, `netPnlFmt`,
`netPnlPositive`, `totalVolumeSol`, `totalVolumeUsd`, `winRate`, `wins`,
`losses`, `tradeCount`, `battleCount`. Only `wallet` is safe.

The error is also concentrated rather than spread. One wallet is shown at
**+159.01 SOL while being -54.37 on chain** - that single row is 213 of the 221
SOL gap - and its volume reads 30.19 against 280.15 measured. **45 of the 145
ranked wallets are shown in profit while down on chain.**

wwtracker's own `top-traders` embed withdrew the P&L column on 2026-09-07 rather
than render it. If you are building something similar, do the same: show volume
and win rate with a caveat if you must, and leave P&L out until the upstream
backfill has run. A wallet displayed as profitable while it is down is the kind
of number people screenshot.

This is not a criticism of the upstream API. It is one query away from being
fixed on their side, it has been reported, and this section will come out when
the numbers agree.

## Known limitation

The last-good store is per server instance and in memory. A cold instance that cannot
reach upstream answers `unknown` rather than serving a value it has never seen. That is
the correct failure, but it means `unknown` is likelier right after a deploy or a scale
event than steady state. Moving the store to shared storage would fix it and is a real
change, not a patch.

## Source

**Most** of this proxies `https://wavewarz.info/api/public/*`, which is built and
maintained by WaveWarZ Intelligence - `stats`, `battle` and all three
`leaderboards`. For those, this is a caching layer in front of it, not a
replacement, and it is not affiliated with or endorsed by that project.

**`positions` is the exception.** It reads Solana directly and has no upstream,
because the holder set is not something the public API exposes. Its `source`
reports the RPC origin rather than `wavewarz.info` for that reason.

`source` is always an **origin only** - scheme and host, never a full URL. That is
deliberate: the RPC endpoint behind `positions` is keyed, and this field used to
carry the whole URL including the key, on a CORS-open route, which published the
credential to every caller. Origin gives you the provenance; the query string
only ever gave away the key.
