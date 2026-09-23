/**
 * Turn a night's stored samples into a record somebody can read.
 *
 *   npx tsx scripts/ww-night-record.ts                    # battles in the newest marks file's span
 *   npx tsx scripts/ww-night-record.ts 1790042941 ...     # named battles
 *   npx tsx scripts/ww-night-record.ts --since-hours 24
 *   npx tsx scripts/ww-night-record.ts --out ~/zao-vault/projects/ww-night-2026-09-23.md
 *
 * The watcher leaves var/ww-live/<id>.jsonl behind and nothing reads it
 * afterwards except a chart. The 2026-09-20 finals were written up from
 * screenshots and memory while the samples sat on disk.
 *
 * Chain is read for each battle's own clock and its settled state, because the
 * store knows pools and not phases. Everything else comes from the samples.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { battlePda } from "../lib/ww/pda";
import { parseJsonl } from "../lib/ww/poolHistory";
import { DEFAULT_DIR, historyPath } from "../lib/poolHistoryStore";
import { buildNightRecord, describeNightRecord } from "../lib/ww/nightRecord";
import { parseMarks, windowFromMarks } from "../lib/ww/windowReport";
import { optionValue } from "../lib/cliArgs";
import { redactUrl } from "../lib/redact";

const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const args = process.argv.slice(2);
const STORE = optionValue(args, "--store", DEFAULT_DIR);
const OUT = optionValue(args, "--out", "");
const SINCE_HOURS = Number(optionValue(args, "--since-hours", "12"));
const MARKS_DIR = join(process.env.HOME ?? "", "zao-vault/projects");
const ids = args.filter((a) => /^\d{9,12}$/.test(a)).map(Number);

function newestMarksFile(): string | null {
  try {
    const f = readdirSync(MARKS_DIR).filter((x) => /^ww-45s-marks-\d{4}-\d{2}-\d{2}\.log$/.test(x)).sort();
    return f.length ? join(MARKS_DIR, f[f.length - 1]) : null;
  } catch { return null; }
}

async function chainClock(battleId: number): Promise<{ startTime: number; endTime: number; settled: boolean } | null> {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [battlePda(battleId), { encoding: "base64" }] }) });
  const j = await res.json();
  if (!j.result?.value) return null;
  const raw = Buffer.from(j.result.value.data[0], "base64");
  return {
    startTime: Number(raw.readBigInt64LE(20)),
    endTime: Number(raw.readBigInt64LE(28)),
    settled: raw[245] !== 0,
  };
}

async function main() {
  let battles = ids;
  let windowNote: string;
  if (battles.length === 0) {
    const marksFile = newestMarksFile();
    const marks = marksFile && existsSync(marksFile) ? parseMarks(readFileSync(marksFile, "utf8")) : [];
    const w = windowFromMarks(marks);
    const from = w ? w.fromMs : Date.now() - SINCE_HOURS * 3600 * 1000;
    const to = w ? w.toMs : Date.now();
    windowNote = w
      ? `the ${marks.length} marks in ${marksFile}, ${new Date(from).toISOString()} to ${new Date(to).toISOString()}`
      : `the last ${SINCE_HOURS} h (no marks file to take a span from)`;
    let names: string[];
    try { names = readdirSync(STORE); }
    catch (err) {
      console.error(`cannot read the store at ${STORE}: ${(err as Error).message}`);
      process.exit(2);
    }
    battles = names.filter((f) => /^\d{9,12}\.jsonl$/.test(f))
      .filter((f) => { try { const m = statSync(join(STORE, f)).mtimeMs; return m >= from && m <= to; } catch { return false; } })
      .map((f) => Number(f.replace(".jsonl", "")));
  } else {
    windowNote = `the ${battles.length} battle(s) named on the command line`;
  }

  const lines: string[] = [
    `# Battle night record`,
    ``,
    `Written ${new Date().toISOString()} from ${STORE}, chain via ${redactUrl(RPC)}.`,
    `Battles selected by ${windowNote}.`,
    ``,
  ];
  if (battles.length === 0) {
    lines.push(`No battle files fell in that window. That is not a statement that no battle ran.`);
  }
  for (const id of battles.sort()) {
    const path = historyPath(STORE, id);
    const { samples, skipped } = parseJsonl(readFileSync(path, "utf8"));
    const clock = await chainClock(id);
    if (!clock) { lines.push(`## Battle ${id}`, ``, `No account on chain for this id, so its clock is UNKNOWN and no record was built.`, ``); continue; }
    const rec = buildNightRecord({ battleId: id, startTime: clock.startTime, endTime: clock.endTime, samples });
    const extra = [`- Settled on chain: ${clock.settled ? "yes" : "NO - a claim against it fails until somebody settles it"}`];
    if (skipped > 0) extra.push(`- **${skipped} line(s) of this battle's store file could not be read**, so the figures above are missing points`);
    lines.push(...describeNightRecord(rec, extra), ``);
  }
  const text = lines.join("\n");
  if (OUT) { writeFileSync(OUT, text); console.log(`wrote ${OUT} (${battles.length} battle(s))`); }
  else console.log(text);
}
main().catch((e) => { console.error(e.message); process.exit(2); });
