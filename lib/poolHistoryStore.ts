/**
 * The disk half of pool history. One JSONL file per battle under a directory
 * that is gitignored (`var/` - "watcher output"), appended by the watcher and
 * read by /api/ww/pool-history.
 *
 * Outside lib/ww on purpose: this imports node:fs and the SDK surface must
 * not. The pure half is lib/ww/poolHistory.ts.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseJsonl, serializeSample, type PoolSample } from "./ww/poolHistory";

export const DEFAULT_DIR = "var/ww-live";

const FILE = /^\d{9,12}$/;

export function historyPath(dir: string, battleId: number): string {
  const id = String(battleId);
  if (!FILE.test(id)) throw new Error(`battle id ${id} is not a 9 to 12 digit number`);
  return join(dir, `${id}.jsonl`);
}

/** Append one sample. Creates the directory on first write. */
export function recordSample(dir: string, battleId: number, sample: PoolSample): void {
  mkdirSync(dir, { recursive: true });
  appendFileSync(historyPath(dir, battleId), serializeSample(sample) + "\n");
}

/**
 * Read a battle's samples. `null` when there is no file, which is a different
 * answer from an empty file: "never watched" versus "watched, nothing kept".
 */
export function readHistory(dir: string, battleId: number): { samples: PoolSample[]; skipped: number } | null {
  const path = historyPath(dir, battleId);
  if (!existsSync(path)) return null;
  return parseJsonl(readFileSync(path, "utf8"));
}
