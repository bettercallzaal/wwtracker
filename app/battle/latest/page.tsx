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

/**
 * WHAT THIS RETURNS WHEN IT CANNOT LOOK.
 *
 * Until 2026-09-22 an unreadable store returned `[]`, which is byte for byte
 * what an empty store returns, and the page then said "No battle recorded yet.
 * The watcher has written nothing to the store." That sentence is a claim
 * about the watcher, and it was made without being able to see the store at
 * all - a missing directory, a WW_LIVE_DIR pointing somewhere else, or a
 * permissions problem all read as "the battle has not started".
 *
 * That is the worst possible failure on a battle night: somebody watches a
 * page that is looking in the wrong place and waits.
 */
function recordedIds(dir: string): { ids: number[]; unreadable: string | null } {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (err) {
    return { ids: [], unreadable: (err as Error).message };
  }
  const ids: number[] = [];
  for (const name of names) {
    const m = name.match(/^(\d{9,12})\.jsonl$/);
    if (!m) continue;
    // A file with nothing in it is a battle nobody has recorded a sample for,
    // and redirecting to its empty chart would be worse than waiting. The stat
    // is guarded because the watcher writes here while this reads: a file can
    // vanish between the listing and the stat, and one such race should not
    // take out the page.
    try {
      if (statSync(join(dir, name)).size > 0) ids.push(Number(m[1]));
    } catch {
      continue;
    }
  }
  return { ids, unreadable: null };
}

export default function LatestBattlePage() {
  const dir = process.env.WW_LIVE_DIR || DEFAULT_DIR;
  const { ids, unreadable } = recordedIds(dir);
  const id = newestBattleId(ids);
  if (id !== null) redirect(`/battle/${id}`);
  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px", color: C.text, fontFamily: C.mono }}>
      <AutoReload seconds={5} />
      {unreadable ? (
        <>
          <p style={{ color: C.danger }}>
            Could not read the store at <code>{dir}</code>, so this page cannot say whether a battle is
            running: {unreadable}
          </p>
          <p style={{ color: C.dim, fontSize: 13 }}>
            This is a problem with this machine, not with the battle. Check that the watcher is running and
            writing there: <code>scripts/ww-night.sh status</code>.
          </p>
        </>
      ) : (
        <p>No battle recorded yet. The watcher has written nothing to {dir}. This page reloads every 5 s.</p>
      )}
    </main>
  );
}
