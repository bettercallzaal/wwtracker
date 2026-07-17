"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/theme";

interface Stats {
  solPriceUsd: number;
  volume: { last24hSol: number; last7dSol: number; totalSol: number };
  battles: { total: number; quickBattles: number };
  liveBattle: unknown;
  updatedAt: string;
}

const STATS_URL = "https://wavewarz.info/api/public/stats";
const POLL_MS = 60_000;

const fmt1 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt2 = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function minsAgo(iso: string): string {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export default function LiveTicker() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [ago, setAgo] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(STATS_URL)
        .then((r) => r.json())
        .then((d: Stats) => {
          if (alive) setStats(d);
        })
        .catch(() => {});

    load();
    const poll = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!stats) return;
    const tick = () => setAgo(minsAgo(stats.updatedAt));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [stats]);

  if (!stats) return null;

  const isLive = !!stats.liveBattle;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "4px 18px",
        alignItems: "center",
        marginBottom: 12,
        padding: "8px 14px",
        borderRadius: 10,
        border: `1px solid ${isLive ? C.good : C.grid}44`,
        background: isLive ? `${C.good}0f` : `${C.elev}`,
        fontFamily: C.mono,
        fontSize: 12,
      }}
    >
      {isLive && (
        <span style={{ color: C.good, fontWeight: 700, fontSize: 11, letterSpacing: "0.06em" }}>
          ● LIVE
        </span>
      )}
      <span>
        <span style={{ color: C.dim }}>SOL </span>
        <span style={{ color: C.accent, fontWeight: 700 }}>${fmt2(stats.solPriceUsd)}</span>
      </span>
      <span>
        <span style={{ color: C.dim }}>24h vol </span>
        <span style={{ fontWeight: 600 }}>{fmt1(stats.volume.last24hSol)} ◎</span>
      </span>
      <span>
        <span style={{ color: C.dim }}>7d vol </span>
        <span style={{ fontWeight: 600 }}>{fmt1(stats.volume.last7dSol)} ◎</span>
      </span>
      <span>
        <span style={{ color: C.dim }}>battles </span>
        <span style={{ fontWeight: 600 }}>{stats.battles.total.toLocaleString()}</span>
      </span>
      {ago && (
        <span style={{ color: C.dim, fontSize: 10, marginLeft: "auto" }}>updated {ago}</span>
      )}
    </div>
  );
}
