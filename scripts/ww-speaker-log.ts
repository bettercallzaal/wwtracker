// Resolves a diarized transcript's anonymous speaker_N labels to real names
// using a manually-captured caption log, and writes the result as a
// SpeakerLogEntry[] JSON file for buildShowRecap to consume.
//
//   tsx scripts/ww-speaker-log.ts --captions <path> --utterances <path> [--out <path>]
//
// --captions    plain text, one caption per line: "<timestampSec> Name @handle: text"
// --utterances  JSON array of { speaker, startSec, endSec, text } (DiarizedUtterance[])
// --out         defaults to recaps/speaker-log.json
//
// Producing the caption log itself is still manual - see
// ~/.claude/skills/identifying-speakers-in-recordings for why X's Spaces
// seek slider and live caption feed resist automation.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseArgs } from "./ww-recap";
import { parseCaptionsFile, resolveSpeakerNames, buildSpeakerLog } from "./recap/speaker-log";
import type { DiarizedUtterance } from "./recap/speaker-log";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

export function run(captionsContent: string, utterancesJson: string): string {
  const captions = parseCaptionsFile(captionsContent);
  const utterances = JSON.parse(utterancesJson) as DiarizedUtterance[];
  const matches = resolveSpeakerNames(utterances, captions);
  const log = buildSpeakerLog(utterances, matches);
  return JSON.stringify(log, null, 2) + "\n";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const captionsPath = args.captions;
  const utterancesPath = args.utterances;
  if (typeof captionsPath !== "string" || typeof utterancesPath !== "string") {
    throw new Error("Usage: tsx scripts/ww-speaker-log.ts --captions <path> --utterances <path> [--out <path>]");
  }
  const outPath =
    typeof args.out === "string" ? args.out : path.join(ROOT, "recaps/speaker-log.json");

  const captionsContent = readFileSync(captionsPath, "utf-8");
  const utterancesJson = readFileSync(utterancesPath, "utf-8");
  const output = run(captionsContent, utterancesJson);

  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
  const entryCount = JSON.parse(output).length;
  console.log(`Wrote ${entryCount} speaker-log entries to ${outPath}`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(`ww-speaker-log failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
