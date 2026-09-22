import { redirect } from "next/navigation";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DIR } from "@/lib/poolHistoryStore";
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
 * Newest by modification time, not by id: a backfilled old battle written a
 * minute ago is not "latest" in the sense that matters, but the watcher's
 * live file is touched every 30 s at least, so during a battle it wins.
 */
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { robots: { index: false, follow: false } };
}

function newestRecorded(dir: string): number | null {
  let best: { id: number; mtime: number } | null = null;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return null;
  }
  for (const name of names) {
    const m = name.match(/^(\d{9,12})\.jsonl$/);
    if (!m) continue;
    const mtime = statSync(join(dir, name)).mtimeMs;
    if (!best || mtime > best.mtime) best = { id: Number(m[1]), mtime };
  }
  return best?.id ?? null;
}

export default function LatestBattlePage() {
  const id = newestRecorded(process.env.WW_LIVE_DIR || DEFAULT_DIR);
  if (id !== null) redirect(`/battle/${id}`);
  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px", color: C.text, fontFamily: C.mono }}>
      <AutoReload seconds={5} />
      <p>No battle recorded yet. The watcher has written nothing to the store. This page reloads every 5 s.</p>
    </main>
  );
}
