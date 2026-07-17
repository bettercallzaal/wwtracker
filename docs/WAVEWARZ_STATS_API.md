# WaveWarZ Public Stats API

> **Endpoint:** `GET https://wavewarz.info/api/public/stats`
> No authentication required. CORS open. ~60 s server-side cache. Safe to call from any front-end.

---

## Response schema

```jsonc
{
  "updatedAt": "2026-07-17T07:03:08.131Z",  // ISO 8601, server cache timestamp
  "solPriceUsd": 74.53,                       // current SOL/USD price

  "volume": {
    "totalSol":    522.2336,   // lifetime traded volume (buy-side SOL committed)
    "totalUsd":    38922.07,   // totalSol × solPriceUsd
    "last24hSol":  0.4952,     // rolling 24h volume
    "last7dSol":   12.086      // rolling 7d volume
  },

  "liveBattle": null,   // null when quiet; object when a battle is live (shape TBD)

  "artistPayouts": {
    "totalSol": 9.0508,
    "totalUsd": 674.56,
    "note":     "Instant, automatic onchain payouts to artists — 1% of trading volume + settlement bonus"
  },

  "traderClaims": {
    "totalSol":       127.3432,
    "totalUsd":       9490.89,
    "withdrawalCount": 939,     // # of claimShares txs parsed onchain
    "note":           "Real trader withdrawals (claimShares), parsed from onchain vault transactions"
  },

  "platformRevenue": {
    "totalSol": 17.4279,
    "totalUsd": 1298.90
  },

  "battles": {
    "total":            1245,
    "mainEvents":       50,    // top-level event containers
    "mainBattles":      162,   // multi-round main-event battle legs
    "quickBattles":     1047,  // single-round quick battles
    "communityBattles": 36     // community-hosted battles
  }
}
```

---

## Field notes

| Field | Type | Notes |
|---|---|---|
| `updatedAt` | ISO 8601 string | Server cache timestamp; refresh is ~60 s |
| `solPriceUsd` | number | Live from Pyth/CoinGecko; used for all USD equivalents |
| `volume.totalSol` | number | Buy-side only; does not double-count sell-side |
| `liveBattle` | object \| null | `null` when quiet; truthy value = a battle is happening now |
| `traderClaims.withdrawalCount` | integer | Count of unique `claimShares` on-chain txs |
| `battles.total` | integer | Sum of mainBattles + quickBattles + communityBattles |
| `battles.mainEvents` | integer | Top-level event wrappers, each may contain multiple mainBattles |

---

## Usage in wwtracker

`LiveTicker.tsx` polls this endpoint every 60 s and surfaces:
- SOL price
- 24h / 7d volume
- total battles
- green **● LIVE** badge when `liveBattle` is truthy

```tsx
// lib/stats.ts (if you want a shared fetcher)
export interface WwStats {
  solPriceUsd: number;
  volume: { totalSol: number; totalUsd: number; last24hSol: number; last7dSol: number };
  liveBattle: unknown;
  artistPayouts: { totalSol: number; totalUsd: number };
  traderClaims: { totalSol: number; totalUsd: number; withdrawalCount: number };
  platformRevenue: { totalSol: number; totalUsd: number };
  battles: { total: number; mainEvents: number; mainBattles: number; quickBattles: number; communityBattles: number };
  updatedAt: string;
}

const STATS_URL = "https://wavewarz.info/api/public/stats";
export async function fetchStats(): Promise<WwStats> {
  const r = await fetch(STATS_URL, { next: { revalidate: 60 } });
  if (!r.ok) throw new Error(`stats ${r.status}`);
  return r.json();
}
```

---

## Hurricane handoff — wavewarz.com front-page integration

> **This section is for Hurricane (wavewarz.com).** The wwtracker LiveTicker integration is live on wwtracker's domain. Paste the block below anywhere in your front-end to get the same ticker.

### Copy-paste snippet (vanilla JS / no framework)

```html
<!-- WaveWarZ Live Stats Ticker -->
<div id="ww-ticker" style="font-family:monospace;font-size:13px;display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:8px 0;"></div>

<script>
(function() {
  const STATS_URL = "https://wavewarz.info/api/public/stats";
  const POLL_MS = 60_000;
  const el = document.getElementById("ww-ticker");
  if (!el) return;

  function render(s) {
    const live = s.liveBattle
      ? '<span style="color:#4ade80;font-weight:700;">&#9679; LIVE</span> '
      : '';
    el.innerHTML =
      live +
      '<span>SOL $' + s.solPriceUsd.toFixed(2) + '</span>' +
      ' &bull; <span>24h ' + s.volume.last24hSol.toFixed(2) + ' &#9676;</span>' +
      ' &bull; <span>7d ' + s.volume.last7dSol.toFixed(2) + ' &#9676;</span>' +
      ' &bull; <span>' + s.battles.total.toLocaleString() + ' battles</span>';
  }

  function poll() {
    fetch(STATS_URL)
      .then(function(r) { return r.json(); })
      .then(render)
      .catch(function() {});
  }

  poll();
  setInterval(poll, POLL_MS);
})();
</script>
```

### Live-battle pin (show a banner when a battle is happening)

```html
<div id="ww-live-pin" style="display:none;background:#14532d;color:#4ade80;padding:8px 16px;border-radius:8px;font-family:monospace;font-weight:700;">
  &#9679; BATTLE LIVE NOW — <a href="https://wavewarz.info" style="color:#4ade80;">join wavewarz.info</a>
</div>

<script>
// Run after the ticker script above has polled at least once, OR call independently:
fetch("https://wavewarz.info/api/public/stats")
  .then(function(r) { return r.json(); })
  .then(function(s) {
    var pin = document.getElementById("ww-live-pin");
    if (pin) pin.style.display = s.liveBattle ? "block" : "none";
  })
  .catch(function() {});
</script>
```

### React / Next.js version

```tsx
"use client";
import { useEffect, useState } from "react";

interface WwStats {
  solPriceUsd: number;
  volume: { last24hSol: number; last7dSol: number };
  battles: { total: number };
  liveBattle: unknown;
}

export function WaveWarzTicker() {
  const [s, setS] = useState<WwStats | null>(null);

  useEffect(() => {
    let alive = true;
    const poll = () =>
      fetch("https://wavewarz.info/api/public/stats")
        .then((r) => r.json())
        .then((d: WwStats) => alive && setS(d))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!s) return null;
  return (
    <div style={{ fontFamily: "monospace", fontSize: 13, display: "flex", gap: 16, flexWrap: "wrap" }}>
      {s.liveBattle && <span style={{ color: "#4ade80", fontWeight: 700 }}>● LIVE</span>}
      <span>SOL ${s.solPriceUsd.toFixed(2)}</span>
      <span>24h {s.volume.last24hSol.toFixed(2)} ◎</span>
      <span>7d {s.volume.last7dSol.toFixed(2)} ◎</span>
      <span>{s.battles.total.toLocaleString()} battles</span>
    </div>
  );
}
```

---

## Smoke test

See `lib/__tests__/stats-api.test.ts` — runs `vitest run` and hits the live endpoint.

```sh
npm test -- stats-api
```
