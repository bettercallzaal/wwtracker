import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The program's first instruction is 2025-05-26. Every Dune query in
// scripts/ww-research.sh filtered block_date >= 2025-08-01, which cut the first
// two months and made every all-time figure run low.
//
// That was found and the DATA was regenerated on 2026-09-05. The filter stayed
// in the script until 2026-09-08, so the fix lived in the output and not in the
// thing that produces it - the next person to regenerate would have silently
// reintroduced a hole somebody had already paid to find.
//
// This test is the difference between fixing a number and fixing a generator.

const script = readFileSync(
  fileURLToPath(new URL("../../scripts/ww-research.sh", import.meta.url)),
  "utf8",
);

/** The program's first instruction, measured on chain. */
const FIRST_INSTRUCTION = "2025-05-26";

describe("the Dune queries reach the whole history", () => {
  it("finds date filters at all, so this cannot pass by finding nothing", () => {
    const filters = script.match(/block_date >= date '(\d{4}-\d{2}-\d{2})'/g) ?? [];
    expect(filters.length).toBeGreaterThanOrEqual(4);
  });

  it("never filters to a date after the program's first instruction", () => {
    const found = [...script.matchAll(/block_date >= date '(\d{4}-\d{2}-\d{2})'/g)]
      .map((m) => m[1]);
    for (const d of found) {
      // A floor at or before the first instruction includes everything. A floor
      // after it silently drops history, and the drop is invisible in the output.
      expect({ filter: d, coversHistory: d <= FIRST_INSTRUCTION }).toEqual({
        filter: d, coversHistory: true,
      });
    }
  });

  it("does not contain the specific floor that caused the incident", () => {
    // Only in the explanatory comment, never in a query.
    const inQueries = /block_date >= date '2025-08-01'/.test(script);
    expect(inQueries).toBe(false);
  });
});
