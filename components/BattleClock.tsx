"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

/**
 * The battle clock, from the chain's `end_time`, not from the host.
 *
 * Quick battles run 376 to 660 s and the room hears about a round about 45 s
 * after the chain opens it (measured at the 2026-09-20 finals). A clock that
 * counts down the chain's own end time is the one number on this page that
 * cannot be late.
 */
export default function BattleClock({ endTime, settled }: { endTime: number; settled: boolean }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const left = endTime - now;
  const mm = Math.floor(Math.abs(left) / 60);
  const ss = Math.abs(left) % 60;
  const clock = `${mm}:${String(ss).padStart(2, "0")}`;

  let label: string;
  let tone: string = C.text;
  if (settled) {
    label = "Settled";
    tone = C.dim;
  } else if (left > 0) {
    label = "Trading open";
    tone = left <= 60 ? C.accent : C.text;
  } else {
    label = "Ended, awaiting settlement";
    tone = C.dim;
  }

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontFamily: C.mono, fontSize: 32, color: tone }}>{settled ? "0:00" : left > 0 ? clock : `-${clock}`}</span>
      <span style={{ ...metaLabel, margin: 0 }}>{label}</span>
    </div>
  );
}
