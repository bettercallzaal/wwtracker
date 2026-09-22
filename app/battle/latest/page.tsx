import { redirect } from "next/navigation";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DIR } from "@/lib/poolHistoryStore";
import { newestBattleId } from "@/lib/ww/poolHistory";
import AutoReload from "@/components/AutoReload";
import { C } from "@/lib/theme";

/**
 * /battle/latest: jump to the battle the watcher wrote to most recently.
 *
 * On a battle night the room hears a round about 45 s after the chain opens
 * it, and the id is only known once the watcher prints "joined". Rather than
 * read a log and type a ten-digit id inside that window, open this URL at
 * the start and refresh: it redirects to the newest file in the store, which
 * is the battle being recorded right now. With nothing recorded it says so
 * and reloads itself every 5 s.
 *
 * Newest by BATTLE ID, which is the battle's start time in unix seconds. It
 * used to be newest by file modification time, and that was wrong in exactly
 * the case it exists for: the watcher keeps writing heartbeats to a battle for
 * 300 s after it ends, so a just-ended battle outranked the one that just
 * opened. Measured live on 2026-09-21.
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { robots: { index: false, follow: false } };
}

function recordedIds(dir: string): number[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const ids: number[] = [];
  for (const name of names) {
    const m = name.match(/^(\d{9,12})\.jsonl$/);
    // A file with nothing in it is a battle nobody has recorded a sample for,
    // and redirecting to its empty chart would be worse than waiting.
    if (m && statSync(join(dir, name)).size > 0) ids.push(Number(m[1]));
  }
  return ids;
}

export default function LatestBattlePage() {
  const id = newestBattleId(recordedIds(process.env.WW_LIVE_DIR || DEFAULT_DIR));
  if (id !== null) redirect(`/battle/${id}`);
  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px", color: C.text, fontFamily: C.mono }}>
      <AutoReload seconds={5} />
      <p>No battle recorded yet. The watcher has written nothing to the store. This page reloads every 5 s.</p>
    </main>
  );
}
