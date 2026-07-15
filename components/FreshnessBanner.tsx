"use client";

import { C } from "@/lib/theme";
import { DATA_AS_OF } from "@/lib/freshness";

// Shows only when the baked snapshot is more than a couple days old, so the
// dashboard can never silently present frozen data as if it were live. Once the
// snapshots are regenerated and DATA_AS_OF is bumped, this hides itself.
const STALE_AFTER_DAYS = 2;

/** `now` defaults to Date.now() at call time; injectable so this stays testable
 * without mocking global time (matches lib/sampleData.ts's determinism rule). */
export function daysSince(iso: string, now: number = Date.now()): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return 0;
  return Math.floor((now - then) / 86_400_000);
}

export default function FreshnessBanner() {
  const stale = daysSince(DATA_AS_OF);
  if (stale <= STALE_AFTER_DAYS) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${C.accent}55`,
        background: `${C.accent}14`,
        color: C.text,
        fontFamily: C.mono,
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontWeight: 700, color: C.accent }}>data through {DATA_AS_OF}</span>
      <span style={{ color: C.dim }}>
        live refresh is paused - the on-chain snapshot is {stale} days old. numbers below are the
        last full pull, not today&apos;s. fresh data returns when the source quota resets.
      </span>
    </div>
  );
}
