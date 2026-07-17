// Generates recap markdown drafts. Three modes:
//   --battle <id> --type main-event   a specific Main Event battle (manual - see docs/superpowers/specs/2026-07-14-recap-pipeline-design.md section 4.2 for why this can't be automatic)
//   --show <space-url> --date <YYYY-MM-DD>   one of the 11 weekly shows
//   --weekly                          trailing-week rollup
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { LEADERBOARD } from "../lib/leaderboard";
import type { StoredBattle } from "./recap/types";
import {
  readState,
  writeState,
  markBattleRecapped,
  markShowRecapped,
  advanceWeeklyCursor,
} from "./recap/state";
import { buildMainEventRecap, buildShowRecap, buildWeeklyRecap, renderRecapMarkdown } from "./recap/format";
import type { RecapContext } from "./recap/format";
import type { DayActivityEntry, LeaderboardEntry } from "./recap/context";
import { slugify } from "./recap/slug";
import { toIsoDate } from "./recap/date";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BATTLES_PATH = path.join(ROOT, "public/ww-battles.json");
const ACTIVITY_PATH = path.join(ROOT, "public/ww-activity.json");
const STATE_PATH = path.join(ROOT, "recaps/STATE.json");

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function loadBattles(): StoredBattle[] {
  return JSON.parse(readFileSync(BATTLES_PATH, "utf-8"));
}

function loadActivity(): DayActivityEntry[] {
  const raw = JSON.parse(readFileSync(ACTIVITY_PATH, "utf-8")) as Array<Record<string, unknown>>;
  return raw.map((r) => ({
    date: String(r.date),
    buys: Number(r.buys),
    sells: Number(r.sells),
    battles: Number(r.battles),
    settled: Number(r.settled),
    claims: Number(r.claims),
  }));
}

function loadLeaderboard(): LeaderboardEntry[] {
  return LEADERBOARD.map((a) => ({ name: a.name, handle: a.handle, rank: a.rank, rec: a.rec, win: a.win }));
}

function buildContext(): RecapContext {
  return { leaderboard: loadLeaderboard(), activity: loadActivity() };
}

function writeRecapFile(dir: string, filename: string, content: string) {
  mkdirSync(dir, { recursive: true });
  const full = path.join(dir, filename);
  writeFileSync(full, content);
  console.log(`Wrote ${full}`);
}

function runMainEvent(battleId: string, force: boolean) {
  const battles = loadBattles();
  const battle = battles.find((b) => b.id === battleId);
  if (!battle) {
    throw new Error(`battle_id ${battleId} not found in public/ww-battles.json`);
  }
  const state = readState(STATE_PATH);
  if (state.recappedBattleIds.includes(battleId) && !force) {
    console.log(`battle_id ${battleId} already recapped - use --force to redo.`);
    return;
  }
  const draft = buildMainEventRecap(battle, buildContext());
  const iso = toIsoDate(battle.date) ?? battle.date;
  const title = `${battle.aHandle ?? battle.a} vs ${battle.bHandle ?? battle.b}`;
  const filename = `${iso}-${battle.id}-${slugify(title)}.md`;
  writeRecapFile(
    path.join(ROOT, "recaps/battles"),
    filename,
    renderRecapMarkdown("main-event", title, battle.date, draft),
  );
  writeState(STATE_PATH, markBattleRecapped(state, battleId));
}

function runShow(spaceUrl: string, dateArg: string | undefined, force: boolean) {
  if (!dateArg) {
    throw new Error("--date <YYYY-MM-DD> is required (Phase B auto-detection from the Space isn't built yet)");
  }
  const iso = toIsoDate(dateArg) ?? dateArg;
  const state = readState(STATE_PATH);
  if (state.recappedShowDates.includes(iso) && !force) {
    console.log(`Show on ${iso} already recapped - use --force to redo.`);
    return;
  }
  const battles = loadBattles();
  const showBattles = battles.filter((b) => toIsoDate(b.date) === iso);
  const draft = buildShowRecap(iso, showBattles, null, buildContext());
  writeRecapFile(
    path.join(ROOT, "recaps/shows"),
    `${iso}-show.md`,
    renderRecapMarkdown("show", `WaveWarZ show (${spaceUrl})`, iso, draft),
  );
  writeState(STATE_PATH, markShowRecapped(state, iso));
}

function runWeekly(dryRun: boolean) {
  const battles = loadBattles();
  const state = readState(STATE_PATH);
  const endIso = new Date().toISOString().slice(0, 10);
  const startIso = state.lastWeeklyRecapEnd
    ? state.lastWeeklyRecapEnd
    : new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const weekBattles = battles.filter((b) => {
    const iso = toIsoDate(b.date);
    return iso !== null && iso > startIso && iso <= endIso;
  });
  const draft = buildWeeklyRecap(weekBattles, startIso, endIso, buildContext());
  const content = renderRecapMarkdown("weekly", `${startIso} to ${endIso}`, endIso, draft);
  if (dryRun) {
    console.log("--- DRY RUN (cursor not advanced) ---");
    console.log(content);
    console.log(`--- window: ${startIso} to ${endIso}, ${weekBattles.length} battles ---`);
    return;
  }
  writeRecapFile(path.join(ROOT, "recaps/weekly"), `${endIso}-weekly.md`, content);
  writeState(STATE_PATH, advanceWeeklyCursor(state, endIso));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = args.force === true;
  const dryRun = args["dry-run"] === true;
  if (typeof args.battle === "string" && args.type === "main-event") {
    runMainEvent(args.battle, force);
  } else if (typeof args.show === "string") {
    runShow(args.show, typeof args.date === "string" ? args.date : undefined, force);
  } else if (args.weekly === true) {
    runWeekly(dryRun);
  } else {
    console.error("Usage: ww-recap --battle <id> --type main-event | --show <url> --date <YYYY-MM-DD> | --weekly [--dry-run]");
    process.exit(1);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(`ww-recap failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
