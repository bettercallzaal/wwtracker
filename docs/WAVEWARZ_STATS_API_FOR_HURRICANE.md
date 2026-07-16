# WaveWarZ Public Stats API — Contract & Integration Guide

**Audience:** Hurricane (hurric4n3ike) — wavewarz.com front-end integration.
**Last verified:** 2026-07-16 (live fetch confirmed).

---

## Endpoint

```
GET https://wavewarz.info/api/public/stats
```

- **Auth:** none
- **CORS:** `Access-Control-Allow-Origin: *` (open — safe to call from any browser origin)
- **Cache:** `cache-control: public` (server caches 60 s; Vercel edge may serve stale up to 60 s)
- **Content-Type:** `application/json`

---

## Response shape

```jsonc
{
  "updatedAt": "2026-07-16T21:52:12.063Z",   // ISO-8601 UTC, when the cache was last refreshed
  "solPriceUsd": 75.93,                        // live SOL/USD spot used for all USD conversions

  "volume": {
    "totalSol": 521.74,        // all-time gross trading volume (SOL)
    "totalUsd": 39615.59,      // totalSol × solPriceUsd
    "last24hSol": 2.63,        // rolling 24 h volume
    "last7dSol": 11.93         // rolling 7 d volume
  },

  // null when no battle is live; object when a battle is in progress
  "liveBattle": null | {
    // shape confirmed when a battle is live — fields TBD by Hurricane
    // safe guard: always null-check before rendering
  },

  "artistPayouts": {
    "totalSol": 9.05,          // cumulative SOL paid out to artists (1% trade fee + settlement bonus)
    "totalUsd": 686.85,
    "note": "Instant, automatic onchain payouts to artists — 1% of trading volume + settlement bonus"
  },

  "traderClaims": {
    "totalSol": 127.34,        // cumulative SOL withdrawn by traders (claimShares)
    "totalUsd": 9669.17,
    "withdrawalCount": 939,    // number of claimShares transactions
    "note": "Real trader withdrawals (claimShares), parsed from onchain vault transactions"
  },

  "platformRevenue": {
    "totalSol": 17.37,         // treasury take (0.5% per trade + 3% of every loser pool)
    "totalUsd": 1318.56
  },

  "battles": {
    "total": 1240,             // all battles ever (all types)
    "mainEvents": 50,          // multi-battle events / tournaments
    "mainBattles": 162,        // individual rounds inside main events
    "quickBattles": 1042,      // standalone quick battles
    "communityBattles": 36     // community / charity battles
  }
}
```

### Field notes

| Field | Source | Notes |
|---|---|---|
| `updatedAt` | server | Use this to drive a "last updated X ago" freshness badge |
| `solPriceUsd` | live oracle | All `*Usd` values are derived from this — don't use a separate oracle |
| `liveBattle` | live chain | `null` most of the time; non-null only during an active trading window (~8:30 PM EST weeknights) |
| `volume.totalSol` | cumulative | All-time, not settled-only; includes open + settled battles |
| `traderClaims.withdrawalCount` | claimShares count | Each withdrawal is one on-chain tx; one trader may have many |
| `battles.total` | all types | = mainBattles + quickBattles + communityBattles (mainEvents is a grouping, not additive) |

---

## wavewarz.com integration — copy-paste block

Drop this into your front-page JS/TS. It handles caching, SOL price, the live-battle pin, and the stats ticker.

```ts
// wavewarz.com front-page stats integration
// Paste into your data-fetch layer. Tested against the live endpoint 2026-07-16.

const STATS_URL = "https://wavewarz.info/api/public/stats";

interface WaveWarZStats {
  updatedAt: string;
  solPriceUsd: number;
  volume: { totalSol: number; totalUsd: number; last24hSol: number; last7dSol: number };
  liveBattle: Record<string, unknown> | null;
  artistPayouts: { totalSol: number; totalUsd: number };
  traderClaims: { totalSol: number; totalUsd: number; withdrawalCount: number };
  platformRevenue: { totalSol: number; totalUsd: number };
  battles: { total: number; mainEvents: number; mainBattles: number; quickBattles: number; communityBattles: number };
}

// Fetch with a 70-second client-side cache (slightly beyond server's 60 s).
let _cache: { data: WaveWarZStats; at: number } | null = null;

export async function fetchStats(): Promise<WaveWarZStats> {
  if (_cache && Date.now() - _cache.at < 70_000) return _cache.data;
  const res = await fetch(STATS_URL);
  if (!res.ok) throw new Error(`stats API ${res.status}`);
  const data: WaveWarZStats = await res.json();
  _cache = { data, at: Date.now() };
  return data;
}

// --- Stats ticker (hero numbers for the front page) ---
export function renderStatsTicker(stats: WaveWarZStats) {
  const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { maximumFractionDigits: dp });
  return {
    totalVolume:    `${fmt(stats.volume.totalSol, 2)} SOL  ($${fmt(stats.volume.totalUsd, 0)})`,
    last24h:        `${fmt(stats.volume.last24hSol, 2)} SOL in 24 h`,
    battles:        `${fmt(stats.battles.total)} battles`,
    artistPayouts:  `${fmt(stats.artistPayouts.totalSol, 2)} SOL to artists`,
    traderClaims:   `${fmt(stats.traderClaims.totalSol, 2)} SOL claimed`,
    traderCount:    `${fmt(stats.traderClaims.withdrawalCount)} trader withdrawals`,
    platformRev:    `${fmt(stats.platformRevenue.totalSol, 2)} SOL platform revenue`,
    updatedAgo:     `Updated ${Math.round((Date.now() - new Date(stats.updatedAt).getTime()) / 1000)}s ago`,
  };
}

// --- Live-battle pin ---
// Renders a "LIVE NOW" banner when a battle is in progress.
// liveBattle is null outside trading windows; non-null during ~8:30 PM EST battles.
export function renderLiveBattlePin(liveBattle: WaveWarZStats["liveBattle"]) {
  if (!liveBattle) return null;   // nothing to show
  // TODO: destructure liveBattle fields once Hurricane confirms the shape
  // e.g. const { artistA, artistB, endsAt } = liveBattle as { artistA: string; artistB: string; endsAt: string }
  return liveBattle;
}

// --- Usage example (React / Next.js) ---
/*
import { useEffect, useState } from "react";
import { fetchStats, renderStatsTicker, renderLiveBattlePin } from "./wavewarStats";

export function HeroStats() {
  const [ticker, setTicker] = useState<ReturnType<typeof renderStatsTicker> | null>(null);
  const [liveBattle, setLiveBattle] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    async function load() {
      const stats = await fetchStats();
      setTicker(renderStatsTicker(stats));
      setLiveBattle(renderLiveBattlePin(stats.liveBattle));
    }
    load();
    const id = setInterval(load, 70_000); // re-poll every 70 s
    return () => clearInterval(id);
  }, []);

  if (!ticker) return <p>Loading stats…</p>;

  return (
    <div>
      {liveBattle && <div className="live-banner">⚡ LIVE BATTLE NOW</div>}
      <p>{ticker.totalVolume}</p>
      <p>{ticker.battles}</p>
      <p>{ticker.last24h}</p>
    </div>
  );
}
*/
```

### Rendering checklist for wavewarz.com

- [ ] **Freshness badge** — show `updatedAt` as "Updated Xs ago" so visitors know the numbers are live
- [ ] **Live-battle pin** — poll every 70 s during battle hours (Mon-Fri ~8:30 PM EST); show a "LIVE NOW" banner when `liveBattle !== null`
- [ ] **Ticker numbers** — `volume.totalSol`, `battles.total`, `volume.last24hSol` are the three hero stats
- [ ] **Artist payout highlight** — `artistPayouts.totalSol` is a strong trust signal ("artists have earned X SOL")
- [ ] **Trader claims** — `traderClaims.totalSol` + `withdrawalCount` shows real user activity
- [ ] **Error state** — if fetch throws, fall back to last good values; don't show zeros

---

## Note on wavewarz.com integration scope

The wwtracker app (this repo / Zaal's side) does **not** own the wavewarz.com front page — that is Hurricane's responsibility. This doc is the handoff. Zaal's app at **wavewarz.info** already implements the stats endpoint and serves this data.

The wwtracker smoke test (see `lib/__tests__/stats-api-smoke.test.ts`) verifies the contract from the outside so regressions surface before deployment.
