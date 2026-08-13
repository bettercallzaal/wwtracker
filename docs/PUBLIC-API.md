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

## Known limitation

The last-good store is per server instance and in memory. A cold instance that cannot
reach upstream answers `unknown` rather than serving a value it has never seen. That is
the correct failure, but it means `unknown` is likelier right after a deploy or a scale
event than steady state. Moving the store to shared storage would fix it and is a real
change, not a patch.

## Source

Everything here proxies `https://wavewarz.info/api/public/*`, which is built and
maintained by WaveWarZ Intelligence. This is a caching layer in front of it, not a
replacement, and it is not affiliated with or endorsed by that project.
