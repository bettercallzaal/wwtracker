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

  it("returns null (skips) if winnerTitle is missing", () => {
    expect(scrapedToStored(scraped({ winnerTitle: null }))).toBeNull();
  });

  it("returns null (skips) if song1Title is missing", () => {
    expect(scrapedToStored(scraped({ song1Title: null }))).toBeNull();
  });

  it("returns null (skips) if song2Title is missing", () => {
    expect(scrapedToStored(scraped({ song2Title: null }))).toBeNull();
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
      [scraped({ battleId: 1781481083, marginPct: 50, totalVolumeSol: 10.5 })],
    );
    const existing = merged.find((b) => b.id === "1781481083");
    expect(existing?.type).toBe("MAIN");
    expect(existing?.vol).toBe(3.4257);
    expect(existing?.margin).toBeNull();
  });

  it("sorts merged battles newest-first by id", () => {
    const { merged } = mergeBattles([existingBattle], [scraped()]);
    expect(merged[0].id).toBe("1784001227");
    expect(merged[1].id).toBe("1781481083");
  });
});
