// Parses WaveWarZ Intelligence /battles page HTML into structured battle
// records. The page embeds each battle as a JSON object inside the React
// flight payload: {"battle_id":1784001227,"dateFormatted":"Jul 14, 2026",...}
// with escaped quotes (\"). Parsing strategy adapted (rewritten without the
// zod dependency, to avoid adding it to this repo) from the private
// ZAOscout repo's src/wavewarz-battles.ts - confirmed against the live page
// 2026-07-14.
import type { ScrapedBattle } from "./types";

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function unescapeFlight(html: string): string {
  // Two passes: raw HTML has \\\" (3 backslashes + quote) for inner quotes
  // (e.g. artist names like GodclouD ft Oly "Luchador"). One pass reduces
  // that to \\" which breaks both extractJsonObjectAt and JSON.parse.
  // Two passes: \\\" → \" (valid JSON escape) and \" → " (outer delimiter).
  return html.replace(/\\"/g, '"').replace(/\\"/g, '"');
}

/** Extract a balanced JSON object starting at the `{` index, respecting
 * string literals and escapes. Returns the object substring or null. */
function extractJsonObjectAt(s: string, startBrace: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startBrace; i < s.length; i += 1) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return s.slice(startBrace, i + 1);
    }
  }
  return null;
}

function normalize(raw: Record<string, unknown>): ScrapedBattle | null {
  const battleId = toNum(raw.battle_id);
  if (battleId === null) return null;
  return {
    battleId,
    date: toStr(raw.dateFormatted),
    song1Title: toStr(raw.song1Title),
    song2Title: toStr(raw.song2Title),
    song1Handle: toStr(raw.song1Handle),
    song2Handle: toStr(raw.song2Handle),
    winnerTitle: toStr(raw.winnerTitle),
    loserTitle: toStr(raw.loserTitle),
    totalVolumeSol: toNum(raw.totalVolSol),
    marginPct: toNum(raw.marginPct),
  };
}

/** Parse all battle records from a /battles page's HTML. Skips any object
 * that fails to parse rather than throwing on a single malformed record. */
export function parseWaveWarzBattlesPage(html: string): ScrapedBattle[] {
  const flight = unescapeFlight(html);
  const battles: ScrapedBattle[] = [];
  const seen = new Set<number>();
  const marker = '{"battle_id":';
  let from = 0;
  while (true) {
    const idx = flight.indexOf(marker, from);
    if (idx < 0) break;
    from = idx + marker.length;
    const objStr = extractJsonObjectAt(flight, idx);
    if (!objStr) continue;
    try {
      const parsed = JSON.parse(objStr) as Record<string, unknown>;
      const battle = normalize(parsed);
      if (battle && !seen.has(battle.battleId)) {
        seen.add(battle.battleId);
        battles.push(battle);
      }
    } catch {
      // malformed slice - skip, don't fail the whole page over one record
    }
  }
  return battles;
}
