"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C, metaLabel } from "@/lib/theme";
import { recordingState, type ChartPoint } from "@/lib/ww/poolHistory";

/**
 * The two pools over time, from /api/ww/pool-history, which the watcher fills.
 *
 * Polls while the battle is live and stops when it is not: the series of a
 * settled battle cannot change, and a settled page left open in a tab should
 * not spend anything.
 *
 * SAYS WHEN THERE IS NOTHING, and why. "not recorded" (the watcher did not run
 * for this battle) is shown as that sentence rather than an empty box, because
 * an empty chart on a live battle reads as "nobody traded", which is the one
 * wrong thing it could say.
 */
export default function PoolChart({
  battleId,
  live,
  labels,
  everyMs = 5_000,
}: {
  battleId: number;
  live: boolean;
  labels: { a: string; b: string };
  everyMs?: number;
}) {
  const [series, setSeries] = useState<ChartPoint[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "not-recorded" | "error">("loading");
  const [newestT, setNewestT] = useState<number | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/ww/pool-history?battleId=${battleId}`);
        const j = await r.json();
        if (!alive) return;
        if (j.status === "ok") {
          setSeries(j.series);
          setNewestT(j.to ?? null);
          setNow(Math.floor(Date.now() / 1000));
          setState("ok");
        } else if (j.status === "not-recorded") {
          setState("not-recorded");
        } else {
          setState("error");
        }
      } catch {
        if (alive) setState("error");
      }
    };
    load();
    if (!live) return () => { alive = false; };
    const id = setInterval(load, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [battleId, live, everyMs]);

  const fmtTime = (t: number) =>
    new Date(t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.grid}`, borderRadius: 10, padding: 16 }}>
      <p style={{ ...metaLabel, marginBottom: 8 }}>Pools over time, SOL</p>
      {state === "loading" && <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Reading the watcher&apos;s record...</p>}
      {state === "not-recorded" && (
        <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>
          The watcher did not record this battle, so there is no series to draw. That is a gap in
          our record, not a quiet market.
        </p>
      )}
      {state === "error" && <p style={{ color: C.danger, fontSize: 13, margin: 0 }}>Could not read the pool history.</p>}
      {state === "ok" && series && series.length < 2 && (
        <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>
          {series.length} sample so far. The line appears once the watcher has two.
        </p>
      )}
      {state === "ok" && series && series.length >= 2 && (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="t" tickFormatter={fmtTime} stroke={C.dim} fontSize={11} minTickGap={40} />
              <YAxis stroke={C.dim} fontSize={11} width={48} tickFormatter={(v: number) => v.toFixed(2)} />
              <Tooltip
                labelFormatter={(t) => fmtTime(Number(t))}
                formatter={(v, name) => [`${Number(v).toFixed(4)} SOL`, name === "aSol" ? labels.a : labels.b]}
                contentStyle={{ background: C.elev, border: `1px solid ${C.grid}`, fontSize: 12 }}
              />
              <Line type="stepAfter" dataKey="aSol" stroke={C.accent} dot={false} strokeWidth={2} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="bSol" stroke={C.blue} dot={false} strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {state === "ok" && (() => {
        const rec = recordingState(newestT, now, live);
        const age = newestT === null ? null : now - newestT;
        // THE LINE THAT TELLS A DEAD WATCHER FROM A QUIET MARKET. On a live
        // battle the heartbeat writes every 30 s, so an old newest sample means
        // nobody is recording, and the chart above is history, not now.
        return (
          <p style={{ fontSize: 12, margin: "8px 0 0", color: rec === "stale" ? C.danger : C.dim, fontFamily: C.mono }}>
            {rec === "recording" && live && `Recording. Last sample ${age}s ago.`}
            {rec === "recording" && !live && "Settled. The series is complete."}
            {rec === "stale" && `NOT RECORDING: last sample ${age}s ago on a live battle. The watcher is not running from this machine.`}
          </p>
        );
      })()}
      <p style={{ color: C.dim, fontSize: 11, margin: "8px 0 0" }}>
        <span style={{ color: C.accent }}>A</span> {labels.a} <span style={{ color: C.blue, marginLeft: 12 }}>B</span> {labels.b}.
        Read from chain every 3 s by the watcher; a step is a trade landing.
      </p>
    </div>
  );
}
