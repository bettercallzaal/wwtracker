# wwtracker public API - embed WaveWarZ stats on your site

Cached, CORS-open endpoints for showing live WaveWarZ numbers on your own pages.

**Base:** `https://wwtracker.vercel.app/api/ww`

---

## What "not for embedding" means here, exactly

Endpoints marked **NOT for embedding** are **not present** in a deployment that
does not run the interface they serve, and they send **no CORS headers** where
they are present.

**They are gated with their own interface** (since 2026-09-22). Each of these
spends a keyed RPC call per request, and each exists for one screen:
`/api/ww/claimable` and `/api/ww/token-balance` for the trade and claim panels,
`/api/ww/trade` for those and the operator page, `/api/ww/diagnose` and
`/api/ww/live-battles` for the finals dashboard, `/api/ww/unsettled` for the
operator page. Where `WW_WIDGET`, `WW_OPERATOR` or `WW_FINALS` is unset, the
screen is a 404 and so is the endpoint - and the 404 is returned before any
upstream call is made, so the cost is closed and not merely the answer. On
`wwtracker.vercel.app` all three are unset, so none of these exist there.

**Where they are present, the only boundary is the absence of CORS headers.**
A browser on another site will refuse to hand the response to that site's
JavaScript; curl, a script or another server is not stopped, because none of
them needs CORS. **There is no server-side origin check and there is no token.**
An `Origin` header cannot do the job - a same-origin GET frequently sends none
and curl never does - and a token a public page can fetch is a token anyone can
fetch. Per-IP rate limiting still applies and answers `429` with `Retry-After`,
but it bounds an accident rather than a determined caller.

`/api/ww/battle-account` is deliberately NOT gated: the public battle page
reads it for every visitor, so it has a real anonymous caller.

Everything these routes return is public on chain, so the concern was never
disclosure; it is the spend. Please use the CORS-open endpoints above instead:
they are cached, they are faster for you, and they cost the chain nothing.

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

### `GET /api/ww/diagnose` - NOT for embedding

The dashboard's two buttons, so nobody needs a terminal during a show.

- no parameters - health of everything the live tools rely on
- `?sig=<signature>` - why one transaction failed
- `?code=6014` - what one error code means

**Per RPC METHOD, not per endpoint.** The public node throttles each method
separately: on 2026-09-20 `getTransaction` was refused for an hour while
`getAccountInfo` and `getProgramAccounts` answered normally. One ping would
have called that endpoint healthy and been right about everything except the
tool that needed it.

It also checks the MODEL, not only the plumbing: that a known battle's stored
supply sits below the curve by the expected flooring residual and no further,
and that a quote comes back as a whole step.

For a signature it decodes our instructions and prints the amount, side and
slippage floor, flagging a buy carrying a floor of 0 - which the program
rejects outright with `InvalidAmount (6006)`. Same answers as
`scripts/ww-doctor.ts` and `scripts/ww-explain.ts`.

No CORS headers (see "What 'not for embedding' means here"). It spends the
keyed endpoint per request, and every error is
passed through `redactSecrets` first, because an RPC failure message carries
the endpoint and the endpoint carries the key.

### `GET /api/ww/live-battles` - NOT for embedding

Every battle that is running right now, decoded from one `getProgramAccounts`,
plus a count of those past their end time and never settled. Optional
`?battle=<id>` pins one battle whatever its phase.

No CORS headers. `getProgramAccounts` over ~1,700 accounts is the most
expensive call this estate makes and it spends the keyed endpoint per request,
so it is not CORS-open and not cached.

**It reports settlement from the account byte, not from the clock.** A battle
past its `end_time` is NOT finished - `winner_decided` at offset 245 is a
separate fact, and a claim against a battle whose byte is still 0 returns
`BattleNotEnded (6009)`. The response carries `winnerDecided` per battle and
`awaitingSettlement` as a count, so a consumer cannot infer "settled" from a
countdown reaching zero. Measured 2026-09-20: 81 battles are in that state.

Feeds `/finals`. If you want battle data to embed, use `/api/ww/battle` or
`/api/ww/positions`, which are public, cached and CORS-open.

### `GET /api/ww/battle-account?battleId=<id>` - NOT for embedding

No CORS headers, like `/api/ww/trade`. It returns the raw Battle account as
base64, plus what the widget needs decoded from it: `poolALamports`,
`poolBLamports`, `supplyA`, `supplyB` (minted supply per side, base units, bytes
196 and 204), `endTime`, `winnerArtistA` (the MARKET winner byte, the larger
pool, not the judged result) and `settled` (byte 245, `winner_decided`). The
supplies were added on 2026-09-21 for the sell path, which prices off the minted
supply rather than the curve's; one decoder, `lib/ww/battleAccountResponse.ts`,
is pinned against `decodeBattle` so the route and the library cannot drift.

It exists for the trading widget, which needs three wallets that live at fixed
offsets in that account and puts them straight into an instruction's account
list. Returning the bytes lets one tested decoder read them, rather than trusting
this route to re-describe the layout. A battle with no account returns `404`
`not-found` rather than a zero-filled object - a derived address always looks
valid, so "no account here" is the only honest answer.

If you want battle data to embed, use `/api/ww/battle` or `/api/ww/positions`,
which are public, cached and CORS-open.

### `GET /api/ww/unsettled` - NOT for embedding, gated by WW_OPERATOR

Every battle past its end time whose `winner_decided` byte is still 0, from a
`getProgramAccounts` over the program, decoded by `lib/ww/discovery.ts`. It is
a 404 unless `WW_OPERATOR=1`, because the scan is the expensive read and the
page it feeds (`/operator`) is an operator's page. No CORS headers, no-store.

| field | is |
|---|---|
| `battles[]` | `battleId`, `pubkey`, `startTime`, `endTime`, `poolLamports {a,b}`, `supply {a,b}`, `account` (the 256-byte discovery slice, base64, enough to build `endBattle`), `preview` |
| `preview` | what the program will do: `winner` by pool (a tie goes to B, measured 2026-09-22 on battle 1790042941), `tie`, `winnerDistribution`, `loserSharePool`, `leavesVaultLamports` (the 10%), `empty` |
| `scanned`, `count`, `readAt` | accounts read, rows returned, when |

`endBattle` is permissionless and the relay accepts it since 2026-09-21; the
launch instructions remain refused.

### `GET /api/ww/pool-history?battleId=<id>` - NOT for embedding

The two pools and supplies of one battle over time, as `scripts/ww-live-watch.ts`
recorded them: one sample per 3 s poll where a pool or supply moved, plus a
heartbeat every 30 s so a flat stretch is a measured flat stretch. This is what
`/battle/<id>` draws. No RPC and no upstream: a file read on the machine that
runs the watcher (`var/ww-live/<id>.jsonl`, gitignored), so it answers only
where the watcher runs.

| field | is |
|---|---|
| `series` | `[{ t, aSol, bSol }]`, unix seconds and SOL, sorted by time |
| `count`, `from`, `to` | how many points and the first and last time |
| `skipped` | malformed lines skipped (a watcher killed mid-write leaves one) |

A battle the watcher did not watch is `404` `not-recorded`, which is a different
answer from an empty series. For those, `npx tsx scripts/ww-pool-backfill.ts <id>`
rebuilds the series from the battle's own transactions (the program's "SOL for
tokens", "SOL to return" and "Total fee" lines, the mint's token deltas), replays
it from zero, checks the end state against the account, and writes the file.
Measured exact on 1789948124 (49 trades) on 2026-09-21.

### `GET /api/ww/token-balance?battleId=<id>&wallet=<address>` - NOT for embedding

No CORS headers and rate limited on the relay's budget, like `/api/ww/claimable`.
How many tokens one wallet holds on each side of one battle, read now: two
`getTokenAccountBalance` calls on the two derived associated token accounts and
nothing else. It exists for the widget's sell path, which needs the balance to
cap the amount, offer "max" and show the share of the side that is leaving.
Read at `confirmed` commitment (since 2026-09-22): the widget polls this after
a trade until the balance moves, and the node's default, `finalized`, trails
`confirmed` by about 13 s of that 15 s budget. `/api/ww/claimable` reads at
`confirmed` for the same reason.

| field | is |
|---|---|
| `balances` | `{ a, b }`, base units, as the mint counts them and as `sellShares` takes them |
| `exists` | `{ a, b }`: whether each associated token account exists. A wallet that never traded this battle has none, and reads as `0` with `false` |
| `tokenAccounts` | `{ a, b }`, the two derived addresses that were read |
| `readAt` | ISO time of the read |

An absent account is the one RPC error answered as zero ("could not find
account"). Every other failure is a `502`, because a node that is behind says
nothing about a balance and reporting `0` for it would tell a holder they hold
nothing.

### `GET /api/ww/claimable?wallet=<address>` - NOT for embedding

**No CORS headers, like `/api/ww/trade`**, so a browser on another site will
refuse the response - and a non-browser caller is not stopped at all. Documented because an undocumented route
is worse than a documented refusal, not because it is available. Rate limited on
the same budget as the relay, and it answers with `Retry-After` when it refuses.

What a wallet can claim from settled battles, **read at request time**. It holds
no cache of any kind - not balances, not a battle list, not a mint-to-battle
index - and every response is `no-store`.

That is a ruling, not an implementation detail. `recon/UNCLAIMED.md` in the
protocol repo killed the obvious version of this, a public page listing every
wallet with money waiting, because **the page going stale is the page working**:
everyone who reads such a list and claims makes a row on it false, and the
failure mode is telling somebody they are owed money they have already taken.
Measured drift was 1.76% in one quiet day. So this endpoint answers about one
wallet, now, and refuses to remember.

| field | is |
|---|---|
| `positions` | one row per held side: `battleId`, `side`, `mint`, `amount` (base units, string), `vaultLamports`, `claimLamports` (what THIS position pays, from `quoteClaim` on the battle's own bytes, exact; null when it could not be computed), `won` |
| `refused` | positions that ARE this wallet's but sit under a token program this client cannot settle. Always present, empty when there are none |
| `scanned` | which token programs were queried, and how many accounts each returned |
| `totalPayableLamports` | vault lamports above the rent floor, summed per battle, not per side |
| `readAt` | when the read happened, so a stale tab is visibly stale |

**`refused` exists because the alternative was silence.** This endpoint used to
query the classic token program only, so a position under Token-2022 was never
fetched and the wallet came back as `positions: []` - the same answer as a wallet
holding nothing. A refused row carries the mint, the battle, the side, the amount,
the owning program, a one-line `reason`, and a `failed` list naming each hazard
(a permanent delegate, a transfer hook, a transfer fee) with why it matters. See
PRD section 17 and `lib/ww/tokenEligibility.ts`.

`scanned` is there so the filter is visible rather than implied: a caller can see
which programs were asked about instead of inferring it from an empty result.

**`vaultLamports` is what the BATTLE holds, not what the wallet is owed.** The
program works out the share at claim time. Rendering it as a personal balance
would be the same misreading in a smaller box.

A position appears only if the wallet holds tokens **and** the vault has more
than the 890,880-lamport rent floor. A vault the RPC could not return is omitted,
never reported as zero - the rule at the bottom of this page applies here too.

### `POST /api/ww/trade` - NOT for embedding

**Every other endpoint on this page is yours to call. This one is not.** It
sends no CORS headers, so a browser on another site will refuse the response.
It is a POST that changes nothing on its own - it relays a transaction your
own wallet has already signed - so the missing CORS headers are the boundary,
not an authorisation check. It is listed here because an undocumented route is worse
than a documented refusal, not because it is available.

It exists because the trading widget has to reach an RPC and ours is keyed. The
key stays on the server and the browser posts through it. Three actions:

| action | does | returns |
|---|---|---|
| `prepare` | fetches a blockhash at `finalized` commitment, cached 4 s | `blockhash`, `lastValidBlockHeight` |
| `preflight` | simulates a signed transaction, never sends | `would-succeed` or `would-fail` with the program's own error |
| `send` | simulates, sends only if it would succeed, then waits up to about 20 s for the cluster's word | `sent` with a `signature` and a `confirmation` (`outcome` of `landed`, `failed` with the chain's error, or `unknown`), or `would-fail` and nothing spent |

`sent` means a node accepted the broadcast and nothing more; `confirmation` is
the answer. `unknown` is not a failure: the transaction may still land, and a
caller should show the signature rather than tell the person it failed.

It refuses to forward anything that is not a WaveWarZ trade. Every instruction
must target the WaveWarZ program, ComputeBudget, or Lighthouse (which Phantom
injects when it signs), and at least one must be a buy, sell or claim -
identified by discriminator, so `initializeBattle` and `endBattle` are refused.
A refusal is a `403` with the reason. See `lib/ww/relayPolicy.ts`.

`send` simulates first on purpose. A transaction that will fail still costs a
fee, and simulating turns `custom program error: 0x1771` into
`Battle has already ended.` for one extra call.

**Legacy transactions only.** A versioned (v0) transaction is refused with a
`403`. The policy resolves programs from the static account-keys array, which an
address lookup table defeats, and lookup tables cannot be resolved without an
on-chain fetch - so refusing is the correct answer rather than guessing.

**Rate limited**, because CORS stops browsers and not `curl`. 20 requests a
minute per caller and a hard global ceiling across all callers, returning `429`
with `Retry-After`. The limit protects the RPC key, not the relay: that key is
what keeps `/live` up, and an unmetered relay is a way to exhaust it that looks
like a broken deployment rather than an attack. The budget is in memory, so it is
per server instance - a mitigation, not a guarantee, and the honest fix is shared
storage.

---

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
