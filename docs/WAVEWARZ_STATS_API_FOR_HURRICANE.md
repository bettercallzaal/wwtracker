# WaveWarZ Stats API — Hurricane Handoff

## Endpoint

```
GET https://wavewarz.info/api/public/stats
```

- **Auth:** None required
- **CORS:** Open (any origin)
- **Cache:** 60s server-side
- **Returns:** `application/json`

Smoke test: `npm run smoke:stats`

---

## Response Shape

```jsonc
{
  "updatedAt": "2026-07-23T22:25:47.450Z",   // ISO 8601 UTC — age of the cache snapshot
  "solPriceUsd": 76,                           // Current SOL/USD price used for USD fields
  "volume": {
    "totalSol": 878.196,                       // All-time trading volume in SOL
    "totalUsd": 66742.91,                      // totalSol × solPriceUsd
    "last24hSol": 2.705,                       // Rolling 24-hour volume
    "last7dSol": 356.621                       // Rolling 7-day volume
  },
  "liveBattle": null,                          // Active battle object, or null when none running
  "artistPayouts": {
    "totalSol": 13.3906,                       // Cumulative onchain artist payouts
    "totalUsd": 1017.69,
    "note": "Instant, automatic onchain payouts to artists — 1% of trading volume + settlement bonus"
  },
  "traderClaims": {
    "totalSol": 381.197,                       // Real claimShares withdrawals parsed from chain
    "totalUsd": 28970.98,
    "withdrawalCount": 1526,                   // Number of distinct withdrawal transactions
    "note": "Real trader withdrawals (claimShares), parsed from onchain vault transactions"
  },
  "platformRevenue": {
    "totalSol": 19.986,                        // Platform fee accumulation
    "totalUsd": 1518.94
  },
  "battles": {
    "total": 1285,                             // All battles ever initiated
    "mainEvents": 51,                          // Tournament main-event groups
    "mainBattles": 165,                        // Individual battles within main events
    "quickBattles": 1084,                      // Standalone quick battles
    "communityBattles": 36                     // Charity / benefit battles
  }
}
```

`liveBattle` shape when a battle IS running:

```jsonc
{
  "id": "...",
  "songA": "Song Title A",
  "songB": "Song Title B"
  // Additional fields TBD — treat unknown keys as extensible
}
```

---

## Hurricane: wavewarz.com Integration

The stats endpoint is free — fetch it client-side, no proxy needed.
The wwtracker dashboard (tracker side) already consumes this endpoint — see `lib/wwData.ts` for the fetch pattern used there.

> **Note:** The wavewarz.com front-page integration is Hurricane's responsibility.
> Copy-paste any of the snippets below directly into your stack.

### Vanilla JS ticker (zero deps, drop into any page)

```html
<!-- WaveWarZ live stats ticker — paste anywhere, no framework needed -->
<div id="ww-ticker" style="display:flex;gap:18px;align-items:center;font-size:14px"></div>
<script>
(async function () {
  const el = document.getElementById('ww-ticker');
  try {
    const r = await fetch('https://wavewarz.info/api/public/stats');
    const d = await r.json();
    const live = d.liveBattle
      ? `<span style="color:#f59e0b;font-weight:700">⚡ LIVE: ${d.liveBattle.songA} vs ${d.liveBattle.songB}</span>`
      : '';
    el.innerHTML = [
      `<span>◎ <strong>${d.volume.totalSol.toFixed(1)}</strong> total volume</span>`,
      live,
      `<span>${d.battles.total.toLocaleString()} battles</span>`,
      `<span>◎ ${d.artistPayouts.totalSol.toFixed(2)} to artists</span>`,
    ].filter(Boolean).join('<span style="opacity:0.3">·</span>');
  } catch (_) {
    el.textContent = '';
  }
})();
</script>
```

### React / Next.js ticker component

```tsx
"use client";
import { useEffect, useState } from "react";

type WwStats = {
  volume: { totalSol: number };
  battles: { total: number };
  artistPayouts: { totalSol: number };
  liveBattle: null | { songA: string; songB: string };
};

export function WaveWarZTicker() {
  const [stats, setStats] = useState<WwStats | null>(null);
  useEffect(() => {
    fetch("https://wavewarz.info/api/public/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);
  if (!stats) return null;
  return (
    <div style={{ display: "flex", gap: 18, alignItems: "center", fontSize: 14 }}>
      <span>◎ <strong>{stats.volume.totalSol.toFixed(1)}</strong> total volume</span>
      {stats.liveBattle && (
        <span style={{ color: "#f59e0b", fontWeight: 700 }}>
          ⚡ LIVE: {stats.liveBattle.songA} vs {stats.liveBattle.songB}
        </span>
      )}
      <span>{stats.battles.total.toLocaleString()} battles</span>
      <span>◎ {stats.artistPayouts.totalSol.toFixed(2)} to artists</span>
    </div>
  );
}
```

### liveBattle pin (show/hide a "battle is live" banner)

```js
// Poll every 30s; show a banner when a battle is running
async function pollLiveBattle(onLive, onIdle) {
  async function check() {
    try {
      const r = await fetch('https://wavewarz.info/api/public/stats');
      const d = await r.json();
      d.liveBattle ? onLive(d.liveBattle) : onIdle();
    } catch (_) {}
  }
  check();
  return setInterval(check, 30_000);
}

// Usage:
pollLiveBattle(
  (battle) => document.getElementById('live-banner').textContent =
    `⚡ LIVE NOW: ${battle.songA} vs ${battle.songB}`,
  () => document.getElementById('live-banner').textContent = '',
);
```

---

## Notes for Hurricane

- The cache is 60s server-side. No need to debounce — calling it every 30s is fine for a live ticker.
- `liveBattle` is `null` between battles. Always guard against null before rendering the live-battle UI.
- `updatedAt` tells you how fresh the snapshot is — display it as "last updated X seconds ago" if you want.
- `artistPayouts.note` and `traderClaims.note` are human-readable strings — suitable for tooltip copy on wavewarz.com.
- USD fields are computed server-side from `solPriceUsd` — they update with each cache refresh.
