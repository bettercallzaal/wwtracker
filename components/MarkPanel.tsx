"use client";

import { useCallback, useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";

/**
 * Two buttons that record a mark for the 45-second window test.
 *
 * WHY IT IS HERE AND NOT IN A TERMINAL. `scripts/ww-mark.sh` works and is
 * rehearsed before every session, and FIVE sessions have still produced no
 * marks file. The step asks the operator to keep a second terminal focused and
 * type into it at the exact moment the host speaks, while trading and
 * listening. This page is the one already in front of them.
 *
 * It renders only where `WW_MARKS` is on, which is the operator's machine, and
 * the route behind it is loopback-only and 404 everywhere else.
 *
 * THE COUNT IS THE POINT, NOT THE BUTTONS. A session that recorded nothing has
 * looked exactly like a session nobody ran, five times. "0 marks today" on the
 * screen all evening is the thing that has been missing.
 */
export default function MarkPanel() {
  const [marks, setMarks] = useState<number | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/ww/mark", { cache: "no-store" });
      if (!res.ok) throw new Error(`marks count: HTTP ${res.status}`);
      const body = await res.json();
      setMarks(typeof body.marks === "number" ? body.marks : null);
    } catch (e) {
      // UNKNOWN, never 0. A count that cannot be read and a count of zero are
      // the two states this panel exists to tell apart.
      setMarks(null);
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mark = async (label: string) => {
    setError(null);
    try {
      const res = await fetch("/api/ww/mark", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.reason || `HTTP ${res.status}`);
      setLast(body.line ?? null);
      await refresh();
    } catch (e) {
      // The operator has one chance at this moment. A failed mark says so.
      setError((e as Error).message);
    }
  };

  const button = {
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: 600,
    borderRadius: 6,
    border: `1px solid ${C.accent}`,
    background: "transparent",
    color: C.accent,
    cursor: "pointer",
  } as const;

  return (
    <div>
      <p style={{ ...metaLabel, marginBottom: 10 }}>Mark the window</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button type="button" style={button} onClick={() => void mark("announce")}>
          Announce
        </button>
        <button type="button" style={button} onClick={() => void mark("sent")}>
          Sent
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: C.dim }}>
        {marks === null
          ? "marks today: UNKNOWN (the count could not be read)"
          : `marks today: ${marks}`}
        {last ? ` - last: ${last}` : ""}
      </p>
      {error && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: C.accent }}>NOT RECORDED: {error}</p>
      )}
    </div>
  );
}
