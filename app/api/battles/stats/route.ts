import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Revalidate every 60s — matches wavewarz.info/api/public/stats cache TTL.
export const revalidate = 60;

interface StoredBattle {
  id: string;
  type: "MAIN" | "QUICK" | "COMMUNITY" | "UNCLASSIFIED";
  date: string;
  a: string;
  b: string;
  winner: string;
  vol: number;
  margin: number | null;
}

interface TopBattle {
  id: string;
  type: string;
  a: string;
  b: string;
  winner: string;
  vol: number;
  date: string;
}

interface StatsPayload {
  source: "wwtracker-local";
  note: string;
  battles: {
    total: number;
    byType: { MAIN: number; QUICK: number; COMMUNITY: number; UNCLASSIFIED: number };
  };
  volume: {
    totalSol: number;
    avgPerBattleSol: number;
    topBattle: TopBattle;
  };
  dateRange: {
    earliest: string;
    latest: string;
  };
  generatedAt: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(): Promise<NextResponse> {
  let battles: StoredBattle[];
  try {
    const raw = readFileSync(
      join(process.cwd(), "public", "ww-battles.json"),
      "utf-8",
    );
    battles = JSON.parse(raw) as StoredBattle[];
  } catch {
    return NextResponse.json(
      { error: "Failed to load battles data" },
      { status: 500, headers: CORS },
    );
  }

  const byType = { MAIN: 0, QUICK: 0, COMMUNITY: 0, UNCLASSIFIED: 0 };
  let totalVol = 0;
  let top: StoredBattle | null = null;
  const dates: string[] = [];

  for (const b of battles) {
    byType[b.type] = (byType[b.type] ?? 0) + 1;
    totalVol += b.vol ?? 0;
    if (!top || b.vol > top.vol) top = b;
    if (b.date) dates.push(b.date);
  }

  const payload: StatsPayload = {
    source: "wwtracker-local",
    note: "Computed from wwtracker intelligence feed (public/ww-battles.json). May lag wavewarz.info/api/public/stats by up to 138 battles due to feed indexing delay.",
    battles: {
      total: battles.length,
      byType,
    },
    volume: {
      totalSol: Math.round(totalVol * 10000) / 10000,
      avgPerBattleSol: battles.length
        ? Math.round((totalVol / battles.length) * 10000) / 10000
        : 0,
      topBattle: top
        ? { id: top.id, type: top.type, a: top.a, b: top.b, winner: top.winner, vol: top.vol, date: top.date }
        : { id: "", type: "", a: "", b: "", winner: "", vol: 0, date: "" },
    },
    dateRange: {
      earliest: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : "",
      latest: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : "",
    },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(payload, { headers: CORS });
}
