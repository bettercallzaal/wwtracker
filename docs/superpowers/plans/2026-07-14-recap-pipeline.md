# WaveWarZ Recap Pipeline (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data-driven recap pipeline - fetch fresh battles, generate
Main Event / show / weekly recap drafts as markdown files, all backed by
verified data with explicit sourcing.

**Architecture:** A set of small pure TypeScript modules under
`scripts/recap/` (parsing, merging, state, context, formatting), each
unit-tested with vitest, wired together by two CLI entry points
(`scripts/ww-battles-fetch.ts`, `scripts/ww-recap.ts`) run via `tsx`. Output
is markdown files under `recaps/`, never auto-posted.

**Tech Stack:** TypeScript, `tsx` (new devDependency, dev-only TS runner),
vitest (already in the repo), Node 20 built-ins only otherwise (`fetch`,
`node:fs`).

**Scope note:** this plan covers Phase A only (battle/show/weekly recap
generation with fresh data). Phase B (X Spaces speaker log) needs real Space
URLs to build/test against and is a fundamentally different execution model
(agent-driven browser session, not a deterministic script) - it gets its own
plan once Zaal shares those links.

## Global Constraints

- PR-only. Never push to main. (Task constraint - carried from the project's
  standing instruction, not from any single task below.)
- Recaps are drafts only - nothing in this pipeline posts anywhere.
- No invented numbers - every figure in a recap's "Data used" section must
  cite the exact source file it came from; anything unavailable goes in "Not
  included," never approximated.
- No emojis, no em dashes, anywhere (drafts, code comments, commit messages).
- Secrets stay in `.env.local`, never committed. This plan doesn't touch
  `DUNE_API_KEY` at all - it only reads existing `lib/wwData.ts` /
  `public/ww-activity.json`, never regenerates them.
- Battle IDs are timestamp-derived and strictly increase with time - verified
  against all 949 current records in `public/ww-battles.json` (2026-07-14),
  zero exceptions. Safe to sort/compare as numbers.
- `type` classification: `marginPct` present -> always `QUICK` (verified, 0
  exceptions across 949 records). `marginPct: null` -> `UNCLASSIFIED` for
  newly fetched battles (cannot be auto-split into MAIN vs COMMUNITY - the
  live feed has no type field, and both existing MAIN and COMMUNITY records
  show `margin: null`). Main Event recaps are always manually triggered by
  `battle_id`.

---

## File Structure

```
scripts/
  recap/
    types.ts            shared interfaces (StoredBattle, ScrapedBattle, RecapDraft, RecapState, SpeakerLogEntry)
    date.ts              toIsoDate() - "Jun 15, 2026" -> "2026-06-15"
    slug.ts              slugify() - filename-safe slugs
    battle-parser.ts     parseWaveWarzBattlesPage() - scrape parsing (adapted from ZAOscout)
    merge-battles.ts     scrapedToStored(), mergeBattles()
    state.ts             readState(), writeState(), markBattleRecapped(), markShowRecapped(), advanceWeeklyCursor()
    context.ts           findLeaderboardEntry(), findDayActivity() + their input types
    format.ts            buildMainEventRecap(), buildShowRecap(), buildWeeklyRecap(), renderRecapMarkdown()
    __tests__/
      date.test.ts
      slug.test.ts
      battle-parser.test.ts
      merge-battles.test.ts
      state.test.ts
      context.test.ts
      format.test.ts
      args.test.ts
  ww-battles-fetch.ts    CLI: refresh public/ww-battles.json from the live feed
  ww-recap.ts            CLI: generate recap markdown files
recaps/
  STATE.json             cursor/idempotency state (seeded empty)
  battles/.gitkeep
  shows/.gitkeep
  weekly/.gitkeep
  spaces/.gitkeep         (Phase B output lands here later)
```

---

### Task 1: Add `tsx`, npm scripts, and the `recaps/` directory structure

**Files:**
- Modify: `package.json`
- Create: `recaps/STATE.json`
- Create: `recaps/battles/.gitkeep`, `recaps/shows/.gitkeep`, `recaps/weekly/.gitkeep`, `recaps/spaces/.gitkeep`

**Interfaces:**
- Produces: `npm run fetch:battles` (runs `scripts/ww-battles-fetch.ts`), `npm run recap` (runs `scripts/ww-recap.ts`), an initial `recaps/STATE.json` every later task reads/writes.

- [ ] **Step 1: Install `tsx` as a devDependency**

Run: `npm install --save-dev tsx`
Expected: `package.json` devDependencies gains a `tsx` entry (whatever version npm resolves - check it lands as e.g. `"tsx": "^4.19.2"` or newer); `package-lock.json` updates.

- [ ] **Step 2: Add the two npm scripts**

Edit `package.json`'s `"scripts"` block to add:

```json
    "fetch:battles": "tsx scripts/ww-battles-fetch.ts",
    "recap": "tsx scripts/ww-recap.ts",
```

(Add these two lines alongside the existing `dev`/`build`/`test` entries - keep the rest of the file untouched.)

- [ ] **Step 3: Create the recaps directory structure and seed state**

Create `recaps/STATE.json`:

```json
{
  "recappedBattleIds": [],
  "lastWeeklyRecapEnd": null,
  "recappedShowDates": []
}
```

Create four empty placeholder files so git tracks the otherwise-empty
directories: `recaps/battles/.gitkeep`, `recaps/shows/.gitkeep`,
`recaps/weekly/.gitkeep`, `recaps/spaces/.gitkeep` (each just an empty file).

- [ ] **Step 4: Verify install and scripts are wired**

Run: `npm run typecheck`
Expected: passes (no `.ts` files added yet that could fail - this just
confirms `npm install` didn't break the existing build).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json recaps/
git commit -m "chore: add tsx and scaffold recaps/ directory for the recap pipeline"
```

---

### Task 2: Shared types, date normalization, and slug helper

**Files:**
- Create: `scripts/recap/types.ts`
- Create: `scripts/recap/date.ts`
- Create: `scripts/recap/slug.ts`
- Test: `scripts/recap/__tests__/date.test.ts`
- Test: `scripts/recap/__tests__/slug.test.ts`

**Interfaces:**
- Produces: `BattleType`, `StoredBattle`, `ScrapedBattle`, `SpeakerLogEntry`, `RecapDraft`, `RecapState` (types.ts); `toIsoDate(display: string): string | null` (date.ts); `slugify(input: string, maxLen?: number): string` (slug.ts).

- [ ] **Step 1: Write `scripts/recap/types.ts`**

```typescript
export type BattleType = "MAIN" | "QUICK" | "COMMUNITY" | "UNCLASSIFIED";

export interface StoredBattle {
  id: string;
  type: BattleType;
  date: string; // display format, e.g. "Jun 15, 2026" - matches public/ww-battles.json
  a: string;
  b: string;
  aHandle: string | null;
  bHandle: string | null;
  winner: string;
  vol: number;
  margin: number | null;
}

export interface ScrapedBattle {
  battleId: number;
  date: string | null;
  song1Title: string | null;
  song2Title: string | null;
  song1Handle: string | null;
  song2Handle: string | null;
  winnerTitle: string | null;
  loserTitle: string | null;
  totalVolumeSol: number | null;
  marginPct: number | null;
}

export interface SpeakerLogEntry {
  timestampSec: number;
  speaker: string;
  captionText?: string;
}

export interface RecapDraft {
  farcaster: string;
  x: string;
  dataUsed: string[];
  notIncluded: string[];
}

export interface RecapState {
  recappedBattleIds: string[];
  lastWeeklyRecapEnd: string | null;
  recappedShowDates: string[];
}
```

- [ ] **Step 2: Write the failing test for `date.ts`**

Create `scripts/recap/__tests__/date.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { toIsoDate } from "@/scripts/recap/date";

describe("toIsoDate", () => {
  it("converts a display date to ISO", () => {
    expect(toIsoDate("Jun 15, 2026")).toBe("2026-06-15");
  });
  it("pads single-digit days", () => {
    expect(toIsoDate("Jul 4, 2026")).toBe("2026-07-04");
  });
  it("returns null for an unparseable string", () => {
    expect(toIsoDate("not a date")).toBeNull();
  });
  it("returns null for an already-ISO string", () => {
    expect(toIsoDate("2026-06-15")).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/date.test.ts`
Expected: FAIL - `Cannot find module '@/scripts/recap/date'` (file doesn't exist yet).

- [ ] **Step 4: Write `scripts/recap/date.ts`**

```typescript
const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Converts a "Mon D, YYYY" display date (as stored in public/ww-battles.json)
 * to an ISO "YYYY-MM-DD" string. Returns null if the input doesn't match. */
export function toIsoDate(display: string): string | null {
  const m = display.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return null;
  const [, mon, day, year] = m;
  const mm = MONTHS[mon];
  if (!mm) return null;
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/date.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing test for `slug.ts`**

Create `scripts/recap/__tests__/slug.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { slugify } from "@/scripts/recap/slug";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Fuck yo feelingZ")).toBe("fuck-yo-feelingz");
  });
  it("strips punctuation", () => {
    expect(slugify("The Decay (Greasy Thoughts II)")).toBe("the-decay-greasy-thoughts-ii");
  });
  it("truncates to maxLen without a trailing hyphen", () => {
    const long = "a".repeat(50);
    const result = slugify(long, 10);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result.endsWith("-")).toBe(false);
  });
  it("falls back to 'battle' for an empty/unslugifiable input", () => {
    expect(slugify("")).toBe("battle");
    expect(slugify("!!!")).toBe("battle");
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/slug.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 8: Write `scripts/recap/slug.ts`**

```typescript
/** Filename-safe slug: lowercase, ASCII-folded, hyphen-separated, capped length. */
export function slugify(input: string, maxLen = 40): string {
  const slug = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const truncated = slug.slice(0, maxLen).replace(/-+$/g, "");
  return truncated || "battle";
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/slug.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 10: Commit**

```bash
git add scripts/recap/types.ts scripts/recap/date.ts scripts/recap/slug.ts scripts/recap/__tests__/date.test.ts scripts/recap/__tests__/slug.test.ts
git commit -m "feat: add recap shared types, date normalization, and slug helper"
```

---

### Task 3: Battle-page parser (vendored from ZAOscout, rewritten without zod)

**Files:**
- Create: `scripts/recap/battle-parser.ts`
- Test: `scripts/recap/__tests__/battle-parser.test.ts`

**Interfaces:**
- Consumes: `ScrapedBattle` (Task 2, `scripts/recap/types.ts`)
- Produces: `parseWaveWarzBattlesPage(html: string): ScrapedBattle[]`

- [ ] **Step 1: Write the failing test**

Create `scripts/recap/__tests__/battle-parser.test.ts`. This fixture mimics
the real React flight payload shape (verified 2026-07-14 against the live
`wavewarz-intelligence.vercel.app/battles` page - quotes are backslash-escaped
exactly like the real payload):

```typescript
import { describe, it, expect } from "vitest";
import { parseWaveWarzBattlesPage } from "@/scripts/recap/battle-parser";

const FIXTURE_HTML = String.raw`
<script>self.__next_f.push([1,"3:[\"$\",\"$L20\",\"1784001227\",{\"data\":{\"battle_id\":1784001227,\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"Saturday in LA\",\"song2Title\":\"CUTTING OLD TIES\",\"song1Handle\":\"BennyJ504WaveWarz\",\"song2Handle\":\"frameworkfortune\",\"totalVolSol\":\"0.5152\",\"winnerTitle\":\"Saturday in LA\",\"loserTitle\":\"CUTTING OLD TIES\",\"marginPct\":\"98\"}}],[\"$\",\"$L20\",\"1783999631\",{\"data\":{\"battle_id\":1783999631,\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"INTRO\",\"song2Title\":\"Say Nothin\",\"song1Handle\":null,\"song2Handle\":\"RoCkY2GriMeY\",\"totalVolSol\":\"0.1477\",\"winnerTitle\":\"INTRO\",\"loserTitle\":\"Say Nothin\",\"marginPct\":null}}]"]);</script>
`;

describe("parseWaveWarzBattlesPage", () => {
  it("extracts every battle object on the page", () => {
    const battles = parseWaveWarzBattlesPage(FIXTURE_HTML);
    expect(battles).toHaveLength(2);
  });

  it("normalizes numeric-string fields to numbers", () => {
    const battles = parseWaveWarzBattlesPage(FIXTURE_HTML);
    const first = battles.find((b) => b.battleId === 1784001227);
    expect(first?.totalVolumeSol).toBe(0.5152);
    expect(first?.marginPct).toBe(98);
  });

  it("preserves null for a missing field", () => {
    const battles = parseWaveWarzBattlesPage(FIXTURE_HTML);
    const second = battles.find((b) => b.battleId === 1783999631);
    expect(second?.song1Handle).toBeNull();
    expect(second?.marginPct).toBeNull();
  });

  it("dedupes if the same battle_id appears twice", () => {
    const doubled = FIXTURE_HTML + FIXTURE_HTML;
    const battles = parseWaveWarzBattlesPage(doubled);
    expect(battles).toHaveLength(2);
  });

  it("returns an empty array for a page with no battle objects", () => {
    expect(parseWaveWarzBattlesPage("<html><body>no battles here</body></html>")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/battle-parser.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/recap/battle-parser.ts`**

```typescript
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
  return html.replace(/\\"/g, '"');
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/battle-parser.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/recap/battle-parser.ts scripts/recap/__tests__/battle-parser.test.ts
git commit -m "feat: add WaveWarZ battles-page parser (vendored from ZAOscout, no zod)"
```

---

### Task 4: Classify + merge scraped battles into the stored schema

**Files:**
- Create: `scripts/recap/merge-battles.ts`
- Test: `scripts/recap/__tests__/merge-battles.test.ts`

**Interfaces:**
- Consumes: `ScrapedBattle`, `StoredBattle`, `BattleType` (Task 2)
- Produces: `scrapedToStored(scraped: ScrapedBattle): StoredBattle | null`, `mergeBattles(existing: StoredBattle[], scraped: ScrapedBattle[]): { merged: StoredBattle[]; added: StoredBattle[] }`

- [ ] **Step 1: Write the failing test**

Create `scripts/recap/__tests__/merge-battles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { scrapedToStored, mergeBattles } from "@/scripts/recap/merge-battles";
import type { ScrapedBattle, StoredBattle } from "@/scripts/recap/types";

function scraped(overrides: Partial<ScrapedBattle> = {}): ScrapedBattle {
  return {
    battleId: 1784001227,
    date: "Jul 14, 2026",
    song1Title: "Saturday in LA",
    song2Title: "CUTTING OLD TIES",
    song1Handle: "BennyJ504WaveWarz",
    song2Handle: "frameworkfortune",
    winnerTitle: "Saturday in LA",
    loserTitle: "CUTTING OLD TIES",
    totalVolumeSol: 0.5152,
    marginPct: 98,
    ...overrides,
  };
}

describe("scrapedToStored", () => {
  it("classifies a battle with a numeric margin as QUICK", () => {
    const s = scrapedToStored(scraped({ marginPct: 98 }));
    expect(s?.type).toBe("QUICK");
  });

  it("classifies a battle with null margin as UNCLASSIFIED", () => {
    const s = scrapedToStored(scraped({ marginPct: null }));
    expect(s?.type).toBe("UNCLASSIFIED");
  });

  it("carries artist handles through", () => {
    const s = scrapedToStored(scraped());
    expect(s?.aHandle).toBe("BennyJ504WaveWarz");
    expect(s?.bHandle).toBe("frameworkfortune");
  });

  it("returns null (skips) if volume can't be parsed - never invents a number", () => {
    expect(scrapedToStored(scraped({ totalVolumeSol: null }))).toBeNull();
  });

  it("returns null (skips) if the date is missing", () => {
    expect(scrapedToStored(scraped({ date: null }))).toBeNull();
  });
});

describe("mergeBattles", () => {
  const existingBattle: StoredBattle = {
    id: "1781481083", type: "MAIN", date: "Jun 15, 2026",
    a: "Stella Estrella", b: "Aporkalypse", aHandle: null, bHandle: null,
    winner: "Stella Estrella", vol: 3.4257, margin: null,
  };

  it("adds a genuinely new battle", () => {
    const { merged, added } = mergeBattles([existingBattle], [scraped()]);
    expect(added).toHaveLength(1);
    expect(merged).toHaveLength(2);
  });

  it("does not duplicate a battle_id already present", () => {
    const { merged, added } = mergeBattles(
      [existingBattle],
      [scraped({ battleId: 1781481083 })],
    );
    expect(added).toHaveLength(0);
    expect(merged).toHaveLength(1);
  });

  it("keeps the existing record's type/handles untouched on a known id", () => {
    const { merged } = mergeBattles(
      [existingBattle],
      [scraped({ battleId: 1781481083, marginPct: 50 })],
    );
    expect(merged.find((b) => b.id === "1781481083")?.type).toBe("MAIN");
  });

  it("sorts merged battles newest-first by id", () => {
    const { merged } = mergeBattles([existingBattle], [scraped()]);
    expect(merged[0].id).toBe("1784001227");
    expect(merged[1].id).toBe("1781481083");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/merge-battles.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/recap/merge-battles.ts`**

```typescript
import type { BattleType, ScrapedBattle, StoredBattle } from "./types";

/** marginPct present -> QUICK (verified: every QUICK record in the current
 * 949-battle snapshot has a numeric margin, 0 exceptions). marginPct null
 * cannot be auto-split into MAIN vs COMMUNITY - the live feed has no type
 * field, and both existing MAIN and COMMUNITY records show margin: null. */
function classifyType(scraped: ScrapedBattle): BattleType {
  return scraped.marginPct === null ? "UNCLASSIFIED" : "QUICK";
}

/** Converts one scraped battle into the stored schema. Returns null (skip,
 * never invent) if a required field didn't parse. */
export function scrapedToStored(scraped: ScrapedBattle): StoredBattle | null {
  if (
    scraped.date === null ||
    scraped.winnerTitle === null ||
    scraped.song1Title === null ||
    scraped.song2Title === null ||
    scraped.totalVolumeSol === null
  ) {
    return null;
  }
  return {
    id: String(scraped.battleId),
    type: classifyType(scraped),
    date: scraped.date,
    a: scraped.song1Title,
    b: scraped.song2Title,
    aHandle: scraped.song1Handle,
    bHandle: scraped.song2Handle,
    winner: scraped.winnerTitle,
    vol: scraped.totalVolumeSol,
    margin: scraped.marginPct,
  };
}

export interface MergeResult {
  merged: StoredBattle[];
  added: StoredBattle[];
}

/** Merges freshly scraped battles into the existing stored list, deduping by
 * id. Existing records are never overwritten - only genuinely new battle_ids
 * get added. Result is sorted newest-first by id (battle ids increase
 * monotonically with time - verified). */
export function mergeBattles(existing: StoredBattle[], scraped: ScrapedBattle[]): MergeResult {
  const existingIds = new Set(existing.map((b) => b.id));
  const added: StoredBattle[] = [];
  for (const s of scraped) {
    const stored = scrapedToStored(s);
    if (!stored) continue;
    if (existingIds.has(stored.id)) continue;
    existingIds.add(stored.id);
    added.push(stored);
  }
  const merged = [...existing, ...added].sort((x, y) => Number(y.id) - Number(x.id));
  return { merged, added };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/merge-battles.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/recap/merge-battles.ts scripts/recap/__tests__/merge-battles.test.ts
git commit -m "feat: add scraped-battle classification and merge logic"
```

---

### Task 5: Fetch CLI - `scripts/ww-battles-fetch.ts`

**Files:**
- Create: `scripts/ww-battles-fetch.ts`
- Test: `scripts/recap/__tests__/fetch-battles.test.ts`

**Interfaces:**
- Consumes: `parseWaveWarzBattlesPage` (Task 3), `mergeBattles` (Task 4), `StoredBattle` (Task 2)
- Produces: `fetchNewBattles(existing: StoredBattle[], fetchPage: FetchPage, maxPages?: number): Promise<{ added: StoredBattle[]; merged: StoredBattle[]; pagesFetched: number }>`, `type FetchPage = (page: number) => Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `scripts/recap/__tests__/fetch-battles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fetchNewBattles } from "@/scripts/ww-battles-fetch";
import type { StoredBattle } from "@/scripts/recap/types";

function battleHtml(battleId: number, marginPct: number | null = 98): string {
  return String.raw`<script>self.__next_f.push([1,"3:[\"$\",\"$L20\",\"${battleId}\",{\"data\":{\"battle_id\":${battleId},\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"A\",\"song2Title\":\"B\",\"song1Handle\":null,\"song2Handle\":null,\"totalVolSol\":\"1.0\",\"winnerTitle\":\"A\",\"loserTitle\":\"B\",\"marginPct\":${marginPct === null ? "null" : `\\"${marginPct}\\"`}}}]"]);</script>`;
}

const existingBattle: StoredBattle = {
  id: "100", type: "QUICK", date: "Jul 10, 2026", a: "X", b: "Y",
  aHandle: null, bHandle: null, winner: "X", vol: 1, margin: 50,
};

describe("fetchNewBattles", () => {
  it("stops paginating once a page yields zero new battles", async () => {
    const pages = [battleHtml(200), battleHtml(100)]; // page 2 is all-known
    const fetchPage = async (page: number) => pages[page - 1];
    const result = await fetchNewBattles([existingBattle], fetchPage, 10);
    expect(result.pagesFetched).toBe(2);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe("200");
  });

  it("merges added battles into the returned merged list", async () => {
    const fetchPage = async () => battleHtml(200);
    const result = await fetchNewBattles([existingBattle], fetchPage, 1);
    expect(result.merged).toHaveLength(2);
  });

  it("fails loud (throws) if a page parses to zero battles", async () => {
    const fetchPage = async () => "<html>empty</html>";
    await expect(fetchNewBattles([existingBattle], fetchPage, 5)).rejects.toThrow(/zero battles/);
  });

  it("respects maxPages as a hard stop", async () => {
    let calls = 0;
    const fetchPage = async (page: number) => {
      calls += 1;
      return battleHtml(1000 + page); // always a new id - never stops naturally
    };
    const result = await fetchNewBattles([existingBattle], fetchPage, 3);
    expect(calls).toBe(3);
    expect(result.pagesFetched).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/fetch-battles.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/ww-battles-fetch.ts`**

```typescript
// Fetches new WaveWarZ battles from the public Battle Intelligence feed and
// merges them into public/ww-battles.json. Fails loud on any HTTP or parse
// error - never falls back to writing stale/partial data silently.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseWaveWarzBattlesPage } from "./recap/battle-parser";
import { mergeBattles } from "./recap/merge-battles";
import type { StoredBattle } from "./recap/types";

const INTELLIGENCE_BASE = "https://wavewarz-intelligence.vercel.app";
const BATTLES_JSON_PATH = fileURLToPath(new URL("../public/ww-battles.json", import.meta.url));

export type FetchPage = (page: number) => Promise<string>;

export function httpFetchPage(fetchImpl: typeof fetch = fetch): FetchPage {
  return async (page: number) => {
    const url = page <= 1 ? `${INTELLIGENCE_BASE}/battles` : `${INTELLIGENCE_BASE}/battles?page=${page}`;
    const res = await fetchImpl(url, { headers: { "User-Agent": "wwtracker-recap/1.0" } });
    if (!res.ok) {
      throw new Error(`/battles page ${page} returned HTTP ${res.status}`);
    }
    return res.text();
  };
}

export interface FetchResult {
  added: StoredBattle[];
  merged: StoredBattle[];
  pagesFetched: number;
}

/** Paginates the /battles feed (newest-first) until a page yields no new
 * battles (the fetch frontier) or maxPages is hit. Throws if any page parses
 * to zero battles - that means the feed's shape changed, not that history
 * ended (history ending looks like "all already known", not "empty"). */
export async function fetchNewBattles(
  existing: StoredBattle[],
  fetchPage: FetchPage,
  maxPages = 10,
): Promise<FetchResult> {
  let merged = existing;
  let allAdded: StoredBattle[] = [];
  let page = 1;
  for (; page <= maxPages; page += 1) {
    const html = await fetchPage(page);
    const scraped = parseWaveWarzBattlesPage(html);
    if (scraped.length === 0) {
      throw new Error(`/battles page ${page} parsed zero battles - feed shape may have changed`);
    }
    const result = mergeBattles(merged, scraped);
    merged = result.merged;
    allAdded = [...allAdded, ...result.added];
    if (result.added.length === 0) {
      return { added: allAdded, merged, pagesFetched: page };
    }
  }
  return { added: allAdded, merged, pagesFetched: maxPages };
}

async function main() {
  const existing: StoredBattle[] = JSON.parse(readFileSync(BATTLES_JSON_PATH, "utf-8"));
  const { added, merged, pagesFetched } = await fetchNewBattles(existing, httpFetchPage());
  if (added.length === 0) {
    console.log(`No new battles found (checked ${pagesFetched} page(s)).`);
    return;
  }
  writeFileSync(BATTLES_JSON_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Added ${added.length} new battle(s) (checked ${pagesFetched} page(s)):`);
  for (const b of added) {
    console.log(`  ${b.id}  ${b.date}  ${b.type}  ${b.a} vs ${b.b}  winner=${b.winner}  vol=${b.vol}`);
  }
  const unclassified = added.filter((b) => b.type === "UNCLASSIFIED");
  if (unclassified.length > 0) {
    console.log(`\n${unclassified.length} battle(s) need manual classification (MAIN vs COMMUNITY):`);
    for (const b of unclassified) console.log(`  ${b.id}  ${b.date}  ${b.a} vs ${b.b}`);
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`ww-battles-fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/fetch-battles.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/ww-battles-fetch.ts scripts/recap/__tests__/fetch-battles.test.ts
git commit -m "feat: add ww-battles-fetch CLI to refresh battles from the live feed"
```

---

### Task 6: Recap cursor/idempotency state - `scripts/recap/state.ts`

**Files:**
- Create: `scripts/recap/state.ts`
- Test: `scripts/recap/__tests__/state.test.ts`

**Interfaces:**
- Consumes: `RecapState` (Task 2)
- Produces: `readState(path: string): RecapState`, `writeState(path: string, state: RecapState): void`, `markBattleRecapped(state, id): RecapState`, `markShowRecapped(state, isoDate): RecapState`, `advanceWeeklyCursor(state, isoEnd): RecapState`

- [ ] **Step 1: Write the failing test**

Create `scripts/recap/__tests__/state.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readState,
  writeState,
  markBattleRecapped,
  markShowRecapped,
  advanceWeeklyCursor,
} from "@/scripts/recap/state";

let dir: string;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("readState", () => {
  it("returns default state when the file doesn't exist", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ww-state-"));
    const state = readState(path.join(dir, "missing.json"));
    expect(state).toEqual({ recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] });
  });

  it("round-trips through writeState", () => {
    dir = mkdtempSync(path.join(tmpdir(), "ww-state-"));
    const file = path.join(dir, "state.json");
    const state = { recappedBattleIds: ["1"], lastWeeklyRecapEnd: "2026-07-07", recappedShowDates: ["2026-07-12"] };
    writeState(file, state);
    expect(readState(file)).toEqual(state);
  });
});

describe("markBattleRecapped", () => {
  it("adds a new battle id", () => {
    const state = { recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    expect(markBattleRecapped(state, "1").recappedBattleIds).toEqual(["1"]);
  });

  it("is idempotent for an already-recapped id", () => {
    const state = { recappedBattleIds: ["1"], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    expect(markBattleRecapped(state, "1").recappedBattleIds).toEqual(["1"]);
  });
});

describe("markShowRecapped", () => {
  it("adds a new show date and is idempotent", () => {
    const state = { recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    const once = markShowRecapped(state, "2026-07-12");
    expect(once.recappedShowDates).toEqual(["2026-07-12"]);
    expect(markShowRecapped(once, "2026-07-12").recappedShowDates).toEqual(["2026-07-12"]);
  });
});

describe("advanceWeeklyCursor", () => {
  it("sets lastWeeklyRecapEnd", () => {
    const state = { recappedBattleIds: [], lastWeeklyRecapEnd: null, recappedShowDates: [] };
    expect(advanceWeeklyCursor(state, "2026-07-14").lastWeeklyRecapEnd).toBe("2026-07-14");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/state.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/recap/state.ts`**

```typescript
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { RecapState } from "./types";

const DEFAULT_STATE: RecapState = {
  recappedBattleIds: [],
  lastWeeklyRecapEnd: null,
  recappedShowDates: [],
};

export function readState(path: string): RecapState {
  if (!existsSync(path)) return { ...DEFAULT_STATE };
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return {
    recappedBattleIds: raw.recappedBattleIds ?? [],
    lastWeeklyRecapEnd: raw.lastWeeklyRecapEnd ?? null,
    recappedShowDates: raw.recappedShowDates ?? [],
  };
}

export function writeState(path: string, state: RecapState): void {
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n");
}

export function markBattleRecapped(state: RecapState, battleId: string): RecapState {
  if (state.recappedBattleIds.includes(battleId)) return state;
  return { ...state, recappedBattleIds: [...state.recappedBattleIds, battleId] };
}

export function markShowRecapped(state: RecapState, isoDate: string): RecapState {
  if (state.recappedShowDates.includes(isoDate)) return state;
  return { ...state, recappedShowDates: [...state.recappedShowDates, isoDate] };
}

export function advanceWeeklyCursor(state: RecapState, isoEnd: string): RecapState {
  return { ...state, lastWeeklyRecapEnd: isoEnd };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/recap/state.ts scripts/recap/__tests__/state.test.ts
git commit -m "feat: add recap cursor/idempotency state module"
```

---

### Task 7: Supporting context lookups - `scripts/recap/context.ts`

**Files:**
- Create: `scripts/recap/context.ts`
- Test: `scripts/recap/__tests__/context.test.ts`

**Interfaces:**
- Produces: `LeaderboardEntry`, `LeaderboardContext`, `DayActivityEntry` (types); `findLeaderboardEntry(board: LeaderboardEntry[], handle: string | null, displayName: string): LeaderboardContext | null`; `findDayActivity(activities: DayActivityEntry[], isoDate: string): DayActivityEntry | null`

- [ ] **Step 1: Write the failing test**

Create `scripts/recap/__tests__/context.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { findLeaderboardEntry, findDayActivity } from "@/scripts/recap/context";
import type { LeaderboardEntry, DayActivityEntry } from "@/scripts/recap/context";

const board: LeaderboardEntry[] = [
  { name: "Geek Myth", handle: "GeEkMyTh_ETH", rank: 3, rec: "3W-0L", win: 100 },
  { name: "Lui", handle: "Cryptogodlui", rank: 1, rec: "4W-0L", win: 100 },
];

describe("findLeaderboardEntry", () => {
  it("matches by handle (case-insensitive)", () => {
    const entry = findLeaderboardEntry(board, "geekmyth_eth", "irrelevant");
    expect(entry).toEqual({ rank: 3, record: "3W-0L", winPct: 100 });
  });

  it("falls back to matching by display name when no handle given", () => {
    const entry = findLeaderboardEntry(board, null, "Lui");
    expect(entry).toEqual({ rank: 1, record: "4W-0L", winPct: 100 });
  });

  it("returns null when nothing matches", () => {
    expect(findLeaderboardEntry(board, "nobody", "Nobody")).toBeNull();
  });
});

describe("findDayActivity", () => {
  const activities: DayActivityEntry[] = [
    { date: "2026-06-15", buys: 54, sells: 36, battles: 2, settled: 3, claims: 19 },
  ];

  it("finds the matching day", () => {
    expect(findDayActivity(activities, "2026-06-15")).toEqual(activities[0]);
  });

  it("returns null when the date isn't present", () => {
    expect(findDayActivity(activities, "2026-01-01")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/context.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/recap/context.ts`**

```typescript
export interface LeaderboardEntry {
  name: string;
  handle: string;
  rank: number;
  rec: string;
  win: number;
}

export interface LeaderboardContext {
  rank: number;
  record: string;
  winPct: number;
}

/** Looks up an artist's Main Event leaderboard standing. Tries the handle
 * first (reliable when the scraper captured one), falls back to matching the
 * display name (needed for older battles that predate handle capture). */
export function findLeaderboardEntry(
  board: LeaderboardEntry[],
  handle: string | null,
  displayName: string,
): LeaderboardContext | null {
  const byHandle = handle
    ? board.find((e) => e.handle.toLowerCase() === handle.toLowerCase())
    : undefined;
  const entry = byHandle ?? board.find((e) => e.name.toLowerCase() === displayName.toLowerCase());
  if (!entry) return null;
  return { rank: entry.rank, record: entry.rec, winPct: entry.win };
}

export interface DayActivityEntry {
  date: string; // ISO YYYY-MM-DD
  buys: number;
  sells: number;
  battles: number;
  settled: number;
  claims: number;
}

export function findDayActivity(activities: DayActivityEntry[], isoDate: string): DayActivityEntry | null {
  return activities.find((a) => a.date === isoDate) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/context.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/recap/context.ts scripts/recap/__tests__/context.test.ts
git commit -m "feat: add leaderboard and daily-activity context lookups"
```

---

### Task 8: Recap formatting - `scripts/recap/format.ts`

**Files:**
- Create: `scripts/recap/format.ts`
- Test: `scripts/recap/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `StoredBattle`, `SpeakerLogEntry`, `RecapDraft` (Task 2); `LeaderboardEntry`, `DayActivityEntry`, `findLeaderboardEntry`, `findDayActivity` (Task 7)
- Produces: `RecapContext` (type); `buildMainEventRecap(battle, context): RecapDraft`; `buildShowRecap(showDate, battles, speakerLog, context): RecapDraft`; `buildWeeklyRecap(battles, weekStart, weekEnd, context): RecapDraft`; `renderRecapMarkdown(kind, title, date, draft): string`

- [ ] **Step 1: Write the failing test**

Create `scripts/recap/__tests__/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  buildMainEventRecap,
  buildShowRecap,
  buildWeeklyRecap,
  renderRecapMarkdown,
} from "@/scripts/recap/format";
import type { RecapContext } from "@/scripts/recap/format";
import type { StoredBattle } from "@/scripts/recap/types";

const context: RecapContext = {
  leaderboard: [{ name: "Geek Myth", handle: "GeEkMyTh_ETH", rank: 3, rec: "3W-0L", win: 100 }],
  activity: [{ date: "2026-06-15", buys: 54, sells: 36, battles: 2, settled: 3, claims: 19 }],
};

const mainEvent: StoredBattle = {
  id: "1781140240", type: "MAIN", date: "Jun 11, 2026",
  a: "Geek Myth", b: "Taji Kamikaze", aHandle: "GeEkMyTh_ETH", bHandle: null,
  winner: "Geek Myth", vol: 11.099, margin: null,
};

const quickBattle: StoredBattle = {
  id: "1781318838", type: "QUICK", date: "Jun 13, 2026",
  a: "Fuck yo feelingZ", b: "ACCELERATE", aHandle: null, bHandle: null,
  winner: "Fuck yo feelingZ", vol: 0.261, margin: 96,
};

describe("buildMainEventRecap", () => {
  it("names the winner and cites the source", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.farcaster).toContain("Geek Myth");
    expect(draft.dataUsed.some((l) => l.includes("public/ww-battles.json") && l.includes("1781140240"))).toBe(true);
  });

  it("includes leaderboard standing when the winner is on the board", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.dataUsed.some((l) => l.includes("rank 3"))).toBe(true);
  });

  it("lists per-battle payout and trade data as not included", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.notIncluded.some((l) => l.includes("payout"))).toBe(true);
  });

  it("has no NaN or undefined anywhere in the output", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    const all = [draft.farcaster, draft.x, ...draft.dataUsed, ...draft.notIncluded].join(" ");
    expect(all).not.toMatch(/NaN|undefined/);
  });

  it("ends both drafts with the standard tag line", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    expect(draft.farcaster.endsWith("@WaveWarZ - wavewarz.com")).toBe(true);
    expect(draft.x.endsWith("@WaveWarZ - wavewarz.com")).toBe(true);
  });
});

describe("buildShowRecap", () => {
  it("rolls up total volume across the night's battles", () => {
    const draft = buildShowRecap("2026-06-15", [quickBattle, mainEvent], null, context);
    expect(draft.dataUsed.some((l) => l.includes("11.36"))).toBe(true); // 11.099 + 0.261
  });

  it("includes platform activity when available for that date", () => {
    const draft = buildShowRecap("2026-06-15", [quickBattle], null, context);
    expect(draft.dataUsed.some((l) => l.includes("54 buys"))).toBe(true);
  });

  it("adds a stream quote line only when a speaker log with captions exists", () => {
    const withoutLog = buildShowRecap("2026-06-15", [quickBattle], null, context);
    expect(withoutLog.dataUsed.some((l) => l.includes("Stream quote"))).toBe(false);

    const withLog = buildShowRecap(
      "2026-06-15",
      [quickBattle],
      [{ timestampSec: 125, speaker: "Hurric4n3Ike", captionText: "big night for the catalog" }],
      context,
    );
    expect(withLog.dataUsed.some((l) => l.includes("Stream quote"))).toBe(true);
    expect(withLog.farcaster).toContain("02:05");
  });
});

describe("buildWeeklyRecap", () => {
  it("reports battle count, total volume, and the top-volume battle", () => {
    const draft = buildWeeklyRecap([mainEvent, quickBattle], "2026-06-09", "2026-06-15", context);
    expect(draft.dataUsed.some((l) => l.includes("Battles this week: 2"))).toBe(true);
    expect(draft.dataUsed.some((l) => l.includes("Top-volume battle"))).toBe(true);
  });

  it("flags leaderboard movement as not included", () => {
    const draft = buildWeeklyRecap([mainEvent], "2026-06-09", "2026-06-15", context);
    expect(draft.notIncluded.some((l) => l.includes("Leaderboard movement"))).toBe(true);
  });
});

describe("renderRecapMarkdown", () => {
  it("produces the expected section headings", () => {
    const draft = buildMainEventRecap(mainEvent, context);
    const md = renderRecapMarkdown("main-event", "Geek Myth vs Taji Kamikaze", "Jun 11, 2026", draft);
    expect(md).toContain("# Main Event Recap - Geek Myth vs Taji Kamikaze - Jun 11, 2026");
    expect(md).toContain("## Draft - Farcaster");
    expect(md).toContain("## Draft - X");
    expect(md).toContain("## Data used");
    expect(md).toContain("## Not included");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/format.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/recap/format.ts`**

```typescript
import type { StoredBattle, SpeakerLogEntry, RecapDraft } from "./types";
import { findLeaderboardEntry, findDayActivity } from "./context";
import type { LeaderboardEntry, DayActivityEntry } from "./context";

const TAG_LINE = "@WaveWarZ - wavewarz.com";

export interface RecapContext {
  leaderboard: LeaderboardEntry[];
  activity: DayActivityEntry[];
}

function battleName(handle: string | null, title: string): string {
  return handle ?? title;
}

function winnerSide(battle: StoredBattle): "a" | "b" | null {
  if (battle.winner === battle.a) return "a";
  if (battle.winner === battle.b) return "b";
  return null;
}

const NOT_INCLUDED_PAYOUT = "Per-battle artist payout: only the platform-aggregate figure exists (8.66 SOL total)";
const NOT_INCLUDED_TRADES = "Notable individual trades: no per-battle trade-level data available";

export function buildMainEventRecap(battle: StoredBattle, context: RecapContext): RecapDraft {
  const aName = battleName(battle.aHandle, battle.a);
  const bName = battleName(battle.bHandle, battle.b);
  const side = winnerSide(battle);
  const winnerName = side === "a" ? aName : side === "b" ? bName : battle.winner;
  const winnerHandle = side === "a" ? battle.aHandle : side === "b" ? battle.bHandle : null;
  const vol = battle.vol.toFixed(2);

  const dataUsed = [
    `Winner: ${winnerName} (source: public/ww-battles.json, battle_id ${battle.id})`,
    `Volume: ${vol} SOL (source: same)`,
  ];
  const board = findLeaderboardEntry(context.leaderboard, winnerHandle, winnerName);
  if (board) {
    dataUsed.push(`Artist standing: rank ${board.rank}, ${board.record} (source: lib/leaderboard.ts snapshot)`);
  }

  const farcaster = `Main Event: ${aName} vs ${bName} on WaveWarZ. ${winnerName} took the win in front of ${vol} SOL in the pool. ${TAG_LINE}`;
  const x = `Main Event: ${aName} vs ${bName}. ${winnerName} wins, ${vol} SOL in the pool. ${TAG_LINE}`;

  return { farcaster, x, dataUsed, notIncluded: [NOT_INCLUDED_PAYOUT, NOT_INCLUDED_TRADES] };
}

function formatMmSs(totalSec: number): string {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function buildShowRecap(
  showDate: string,
  battles: StoredBattle[],
  speakerLog: SpeakerLogEntry[] | null,
  context: RecapContext,
): RecapDraft {
  const totalVol = battles.reduce((sum, b) => sum + b.vol, 0);
  const dataUsed = [
    `Battles that night: ${battles.length} (source: public/ww-battles.json, date ${showDate})`,
    `Total volume: ${totalVol.toFixed(2)} SOL (source: same)`,
  ];

  const activity = findDayActivity(context.activity, showDate);
  if (activity) {
    dataUsed.push(
      `Platform activity that day: ${activity.buys} buys / ${activity.sells} sells / ${activity.claims} claims (source: public/ww-activity.json)`,
    );
  }

  const top = battles.slice().sort((a, b) => b.vol - a.vol)[0] ?? null;
  const topLine = top
    ? `${battleName(top.aHandle, top.a)} vs ${battleName(top.bHandle, top.b)} (${top.winner} won, ${top.vol.toFixed(2)} SOL)`
    : "no battles logged";

  let quoteSuffix = "";
  if (speakerLog) {
    const withCaption = speakerLog.find((e) => e.captionText);
    if (withCaption && withCaption.captionText) {
      const ts = formatMmSs(withCaption.timestampSec);
      quoteSuffix = ` ${withCaption.speaker}: "${withCaption.captionText}" (per space replay at ${ts}).`;
      dataUsed.push(`Stream quote: ${withCaption.speaker} at ${ts} (source: recaps/spaces speaker log)`);
    }
  }

  const farcaster = `WaveWarZ show recap - ${showDate}. ${battles.length} battles, ${totalVol.toFixed(2)} SOL total volume. Top: ${topLine}.${quoteSuffix} ${TAG_LINE}`;
  const x = `WaveWarZ ${showDate}: ${battles.length} battles, ${totalVol.toFixed(2)} SOL. Top: ${topLine}. ${TAG_LINE}`;

  return { farcaster, x, dataUsed, notIncluded: [NOT_INCLUDED_PAYOUT] };
}

export function buildWeeklyRecap(
  battles: StoredBattle[],
  weekStart: string,
  weekEnd: string,
  context: RecapContext,
): RecapDraft {
  void context; // reserved for future weekly-context use (e.g. week-over-week leaderboard once history exists)
  const totalVol = battles.reduce((sum, b) => sum + b.vol, 0);
  const topVolume = battles.slice().sort((a, b) => b.vol - a.vol)[0] ?? null;
  const withMargin = battles.filter((b): b is StoredBattle & { margin: number } => b.margin !== null);
  const closestMargin = withMargin.slice().sort((a, b) => a.margin - b.margin)[0] ?? null;

  const artistCounts = new Map<string, number>();
  for (const b of battles) {
    artistCounts.set(battleName(b.aHandle, b.a), (artistCounts.get(battleName(b.aHandle, b.a)) ?? 0) + 1);
    artistCounts.set(battleName(b.bHandle, b.b), (artistCounts.get(battleName(b.bHandle, b.b)) ?? 0) + 1);
  }
  const mostActive = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const dataUsed = [
    `Battles this week: ${battles.length} (source: public/ww-battles.json, ${weekStart} to ${weekEnd})`,
    `Total volume: ${totalVol.toFixed(2)} SOL (source: same)`,
  ];
  if (topVolume) {
    dataUsed.push(
      `Top-volume battle: ${battleName(topVolume.aHandle, topVolume.a)} vs ${battleName(topVolume.bHandle, topVolume.b)}, ${topVolume.vol.toFixed(2)} SOL (source: same, battle_id ${topVolume.id})`,
    );
  }
  if (closestMargin) {
    dataUsed.push(
      `Closest battle: ${battleName(closestMargin.aHandle, closestMargin.a)} vs ${battleName(closestMargin.bHandle, closestMargin.b)}, margin ${closestMargin.margin}% (source: same, battle_id ${closestMargin.id})`,
    );
  }
  if (mostActive) {
    dataUsed.push(`Most active artist: ${mostActive[0]}, ${mostActive[1]} battle(s) (source: same)`);
  }

  const farcaster = `WaveWarZ weekly recap, ${weekStart} to ${weekEnd}. ${battles.length} battles, ${totalVol.toFixed(2)} SOL total volume.${topVolume ? ` Biggest: ${battleName(topVolume.aHandle, topVolume.a)} vs ${battleName(topVolume.bHandle, topVolume.b)}.` : ""} ${TAG_LINE}`;
  const x = `WaveWarZ week of ${weekStart}: ${battles.length} battles, ${totalVol.toFixed(2)} SOL. ${TAG_LINE}`;

  return {
    farcaster,
    x,
    dataUsed,
    notIncluded: ["Leaderboard movement: no historical snapshot to diff against yet"],
  };
}

export function renderRecapMarkdown(
  kind: "show" | "main-event" | "weekly",
  title: string,
  date: string,
  draft: RecapDraft,
): string {
  const heading = kind === "show" ? "Show Recap" : kind === "main-event" ? "Main Event Recap" : "Weekly Recap";
  const lines = [
    `# ${heading} - ${title} - ${date}`,
    "",
    "## Draft - Farcaster",
    draft.farcaster,
    "",
    "## Draft - X",
    draft.x,
    "",
    "## Data used",
    ...draft.dataUsed.map((d) => `- ${d}`),
  ];
  if (draft.notIncluded.length > 0) {
    lines.push("", "## Not included (unverifiable at this granularity)", ...draft.notIncluded.map((d) => `- ${d}`));
  }
  return lines.join("\n") + "\n";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/format.test.ts`
Expected: PASS (11 tests). If the volume-sum assertion (`11.36`) fails due to
floating-point display, check `toFixed(2)` rounding on `11.099 + 0.261 =
11.36` - this should match exactly at 2 decimal places.

- [ ] **Step 5: Commit**

```bash
git add scripts/recap/format.ts scripts/recap/__tests__/format.test.ts
git commit -m "feat: add recap drafting (main event, show, weekly) and markdown rendering"
```

---

### Task 9: Recap CLI - `scripts/ww-recap.ts`

**Files:**
- Create: `scripts/ww-recap.ts`
- Test: `scripts/recap/__tests__/args.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2-8 (`format.ts`, `state.ts`, `context.ts`, `date.ts`, `slug.ts`, `StoredBattle`)
- Produces: `parseArgs(argv: string[]): Record<string, string | boolean>` (the only piece of this CLI worth unit-testing in isolation - the rest is I/O orchestration, exercised manually per the verification step below)

- [ ] **Step 1: Write the failing test**

Create `scripts/recap/__tests__/args.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseArgs } from "@/scripts/ww-recap";

describe("parseArgs", () => {
  it("parses a flag with a value", () => {
    expect(parseArgs(["--battle", "123", "--type", "main-event"])).toEqual({
      battle: "123",
      type: "main-event",
    });
  });

  it("parses a boolean flag with no value", () => {
    expect(parseArgs(["--weekly"])).toEqual({ weekly: true });
  });

  it("parses a mix of value and boolean flags", () => {
    expect(parseArgs(["--show", "https://x.com/i/spaces/abc", "--force"])).toEqual({
      show: "https://x.com/i/spaces/abc",
      force: true,
    });
  });

  it("returns an empty object for no args", () => {
    expect(parseArgs([])).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/recap/__tests__/args.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Write `scripts/ww-recap.ts`**

```typescript
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

function runWeekly() {
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
  writeRecapFile(
    path.join(ROOT, "recaps/weekly"),
    `${endIso}-weekly.md`,
    renderRecapMarkdown("weekly", `${startIso} to ${endIso}`, endIso, draft),
  );
  writeState(STATE_PATH, advanceWeeklyCursor(state, endIso));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const force = args.force === true;
  if (typeof args.battle === "string" && args.type === "main-event") {
    runMainEvent(args.battle, force);
  } else if (typeof args.show === "string") {
    runShow(args.show, typeof args.date === "string" ? args.date : undefined, force);
  } else if (args.weekly === true) {
    runWeekly();
  } else {
    console.error("Usage: ww-recap --battle <id> --type main-event | --show <url> --date <YYYY-MM-DD> | --weekly");
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/recap/__tests__/args.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Manually verify the CLI end-to-end against real data**

Run: `npm run recap -- --weekly`
Expected: writes `recaps/weekly/<today's-date>-weekly.md` and updates
`recaps/STATE.json`'s `lastWeeklyRecapEnd`. Open the generated file and
confirm every line in "Data used" cites a real source and the numbers look
sane (cross-check one manually against `public/ww-battles.json`).

Then run: `npm run recap -- --battle 1781140240 --type main-event`
Expected: writes `recaps/battles/2026-06-11-1781140240-geekmyth-eth-vs-taji-kamikaze.md`
(exact slug depends on `slugify` output - check the actual file). Confirm the
draft names Geek Myth as the winner with 11.10 SOL volume (matches the
verified figure from research).

- [ ] **Step 6: Commit**

```bash
git add scripts/ww-recap.ts scripts/recap/__tests__/args.test.ts recaps/
git commit -m "feat: add ww-recap CLI (main event, show, weekly modes)"
```

---

### Task 10: README pointer + full-suite verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Add a "Recaps" section to `README.md`**

Add this section after the existing "## Docs" section (before "## How it
works"), matching the file's existing tone and heading level:

```markdown
## Recaps

Draft recap posts (Farcaster/X) for WaveWarZ battles - never auto-posted,
always human-reviewed.

- `npm run fetch:battles` - refreshes `public/ww-battles.json` from the live
  WaveWarZ Intelligence feed. Fails loud on any fetch/parse error rather than
  writing stale data.
- `npm run recap -- --battle <id> --type main-event` - drafts a recap for a
  specific Main Event battle (manually triggered - see
  `docs/superpowers/specs/2026-07-14-recap-pipeline-design.md` for why this
  can't be auto-detected).
- `npm run recap -- --show <space-url> --date <YYYY-MM-DD>` - drafts a recap
  for one of the 11 weekly shows (weekday 11am EST AMAs, 8:30pm EST Quick
  Battle nights).
- `npm run recap -- --weekly` - rolls up the trailing week into one recap.

Output lands in `recaps/battles/`, `recaps/shows/`, `recaps/weekly/` as
markdown files with a "Data used" section citing the exact source for every
number, and a "Not included" section for anything that can't be verified at
that granularity (no per-battle payout/trade data exists).
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS - every test file added in Tasks 2-9, plus the pre-existing
`csv.test.ts` / `distributions.test.ts` / `price-solana.test.ts`, all green.

- [ ] **Step 3: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: both pass. `npm run build` confirms adding `scripts/**/*.ts` didn't
break the Next.js build (these files aren't imported by the app, but
`tsconfig.json`'s `include` covers them, so a stray type error here would
otherwise only surface via `typecheck`).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document the recap pipeline commands"
```

---

## Self-Review Notes (completed during planning)

- **Spec coverage:** section 4.1 (fetch) -> Task 5; 4.2/4.3 (units + state,
  including the classification correction) -> Tasks 4, 6, 9; 4.4 (generator)
  -> Task 9; 4.5 (output format) -> Task 8's `renderRecapMarkdown`; 4.6
  (testing) -> every task's test file. Section 5 (Phase B) is explicitly out
  of scope for this plan (see the Scope note at the top). Section 6
  (constraints) -> the Global Constraints block above.
- **Placeholder scan:** no TBD/TODO; every step has real code.
- **Type consistency:** `StoredBattle`, `ScrapedBattle`, `RecapDraft`,
  `RecapState`, `RecapContext`, `LeaderboardEntry`, `DayActivityEntry` are
  each defined once (Task 2 or 7) and imported with matching names/shapes in
  every later task - checked Tasks 4/5/6/7/8/9 against the Task 2/7
  definitions.
