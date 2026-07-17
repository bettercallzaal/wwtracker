"use client";

import { useEffect, useState } from "react";
import { C } from "@/lib/theme";

interface LiveBattle {
  battleId: number;
  type: string;
  artist1: { name: string; poolSol: number; volumeSol: number };
  artist2: { name: string; poolSol: number; volumeSol: number };
  endsAt: string;
  url: string;
}

const STATS_URL = "https://wavewarz.info/api/public/stats";
const POLL_MS = 30_000;
const fmt3 = (n: number) => n.toFixed(3);

export default function LiveBattleBanner() {
  const [battle, setBattle] = useState<LiveBattle | null | undefined>(undefined);
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const r = await fetch(STATS_URL).then((res) => res.json());
        if (mounted) setBattle(r.liveBattle ?? null);
      } catch {
        if (mounted && battle === undefined) setBattle(null);
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, POLL_MS);
    return () => { mounted = false; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live countdown to battle end
  useEffect(() => {
    if (!battle) { setSecsLeft(null); return; }
    const tick = () => {
      const ms = new Date(battle.endsAt).getTime() - Date.now();
      setSecsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [battle]);

  // undefined = loading (first fetch not done), null = no live battle
  if (!battle) return null;

  const countdown =
    secsLeft !== null
      ? `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, "0")}`
      : "–";

  const totalPool = battle.artist1.poolSol + battle.artist2.poolSol;
  const pctA = totalPool > 0 ? (battle.artist1.poolSol / totalPool) * 100 : 50;

  return (
    <a
      href={battle.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "rgba(255,60,60,0.08)",
        border: `1px solid rgba(255,60,60,0.3)`,
        borderRadius: 10,
        textDecoration: "none",
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: C.danger, fontFamily: C.mono, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        ● LIVE {battle.type.toUpperCase()}
      </span>
      <span style={{ color: C.text, fontFamily: C.mono, fontSize: 13, fontWeight: 600 }}>
        {battle.artist1.name} <span style={{ color: C.dim }}>vs</span> {battle.artist2.name}
      </span>
      <span style={{ color: C.dim, fontFamily: C.mono, fontSize: 12, flexShrink: 0 }}>
        {fmt3(battle.artist1.poolSol)} ◎ / {fmt3(battle.artist2.poolSol)} ◎
      </span>
      <span style={{ color: C.accent, fontFamily: C.mono, fontSize: 12, fontWeight: 600, marginLeft: "auto", flexShrink: 0 }}>
        {countdown} left ↗
      </span>
      {/* pool bar */}
      <div style={{ width: "100%", height: 3, background: C.grid, borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{ width: `${pctA}%`, height: "100%", background: C.accent, borderRadius: 999 }}
        />
      </div>
    </a>
  );
}
