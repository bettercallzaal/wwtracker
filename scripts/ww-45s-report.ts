#!/usr/bin/env tsx
/**
 * After a battle night: the 45-second window, per battle, as numbers.
 *
 *   npx tsx scripts/ww-45s-report.ts                          # the battles the marks cover; the last 6 h if there are no marks
 *   ... --since-hours 24                                      # widen the no-marks window
 *   npx tsx scripts/ww-45s-report.ts 1789948124 1789949789    # named battles
 *   ... --marks ~/zao-vault/projects/ww-45s-marks-2026-09-21.log   # default: today's file
 *   ... --store var/ww-live
 *
 * Reads the marker log (scripts/ww-mark.sh), the watcher's samples, and each
 * battle account's start_time and end_time from chain, and prints, per battle:
 * the lag from chain open to the announce mark, how many trades landed before
 * the room heard it, and where each "sent" mark fell. Unknowns print as
 * UNKNOWN, never as 0.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { battlePda } from "../lib/ww/pda";
import { parseJsonl } from "../lib/ww/poolHistory";
import { DEFAULT_DIR, historyPath } from "../lib/poolHistoryStore";
import { battleWindow, describeWindow, parseMarks, windowFromMarks } from "../lib/ww/windowReport";
import { redactUrl } from "../lib/redact";
import { optionValue } from "../lib/cliArgs";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const args = process.argv.slice(2);
// Via lib/cliArgs so a flag in FIRST position is not silently dropped: this
// line used to read `i > 0` against an already-sliced array, which returned
// the default for `--marks FILE` when --marks was the first argument.
const opt = (n: string, d: string) => optionValue(args, n, d);
const today = new Date().toISOString().slice(0, 10);
const MARKS_DIR = join(process.env.HOME ?? "", "zao-vault/projects");
/**
 * Today's marks file if it exists, otherwise the NEWEST one in that directory.
 * A session that runs at night is reported on the next morning, by which time
 * "today" is a different day and the default pointed at a file nobody had
 * written. Falling back is only safe because the chosen path is printed.
 */
function defaultMarksFile(): string {
  const todays = join(MARKS_DIR, `ww-45s-marks-${today}.log`);
  if (existsSync(todays)) return todays;
  try {
    const prior = readdirSync(MARKS_DIR)
      .filter((f) => /^ww-45s-marks-\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .sort();
    const newest = prior[prior.length - 1];
    return newest ? join(MARKS_DIR, newest) : todays;
  } catch {
    return todays;
  }
}
const MARKS = opt("--marks", defaultMarksFile());
const SINCE_HOURS = Number(opt("--since-hours", "6"));
const STORE = opt("--store", DEFAULT_DIR);
const ids = args.filter((a) => /^\d{9,12}$/.test(a)).map(Number);

async function account(id: number): Promise<{ startTime: number; endTime: number } | null> {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [battlePda(id), { encoding: "base64" }] }) });
  const j = await res.json();
  if (!j.result?.value) return null;
  const raw = Buffer.from(j.result.value.data[0], "base64");
  return { startTime: Number(raw.readBigInt64LE(20)), endTime: Number(raw.readBigInt64LE(28)) };
}

async function main() {
  const marks = existsSync(MARKS) ? parseMarks(readFileSync(MARKS, "utf8")) : [];
  console.log(`marks: ${marks.length} from ${MARKS}${existsSync(MARKS) ? "" : " (FILE MISSING: every lag below is UNKNOWN)"}`);
  let battles = ids;
  if (battles.length === 0) {
    // THE MARKS DEFINE THE SESSION. A clock window only applies when there are
    // none, and either way the window used is printed, because "nothing to
    // report" is a different statement from "I looked at the wrong hours".
    const marked = windowFromMarks(marks);
    const from = marked ? marked.fromMs : Date.now() - SINCE_HOURS * 3600 * 1000;
    const to = marked ? marked.toMs : Date.now();
    let names: string[];
    try {
      names = readdirSync(STORE);
    } catch (err) {
      console.log(`battles: CANNOT READ the store at ${STORE}: ${(err as Error).message}`);
      console.log("nothing to report, and that is a problem with this machine rather than the session");
      return;
    }
    battles = names
      .filter((f) => /^\d{9,12}\.jsonl$/.test(f))
      .filter((f) => {
        try {
          const m = statSync(join(STORE, f)).mtimeMs;
          return m >= from && m <= to;
        } catch {
          return false;
        }
      })
      .map((f) => Number(f.replace(".jsonl", "")));
    const window = marked
      ? `the marks' own span, ${new Date(from).toLocaleString()} to ${new Date(to).toLocaleString()} (one hour either side)`
      : `the last ${SINCE_HOURS} h, because there are no marks to take a span from`;
    console.log(`battles: ${battles.length} in ${STORE} touched within ${window}`);
  }
  if (battles.length === 0) { console.log("nothing to report"); return; }
  console.log(`accounts via ${redactUrl(RPC)}\n`);
  for (const id of battles.sort()) {
    const acct = await account(id);
    if (!acct) { console.log(`battle ${id}: no account on chain, skipped`); continue; }
    const file = historyPath(STORE, id);
    const samples = existsSync(file) ? parseJsonl(readFileSync(file, "utf8")).samples : [];
    for (const line of describeWindow(battleWindow(id, acct, marks, samples))) console.log(line);
    console.log("");
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
