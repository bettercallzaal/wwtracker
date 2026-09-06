import { describe, it, expect } from "vitest";
import { findUnsourcedFigures } from "@/lib/newsletterCheck";

// The whole point of the facts pipeline: a model handed real figures should
// not be able to slip an invented one into an email to subscribers. This is
// the last line of defence, and it reports rather than edits - a human decides.
const FIGURES = {
  volumeTotalSol: 922.297,
  volume24hSol: 1.084,
  volume7dSol: 12.5,
  battlesTotal: 1501,
  artistPayoutsSol: 14.36,
};

describe("findUnsourcedFigures", () => {
  it("passes a draft that only uses supplied figures", () => {
    const draft = "Volume reached 922.297 SOL across 1501 battles. Artists took 14.36 SOL.";
    expect(findUnsourcedFigures(draft, FIGURES)).toEqual([]);
  });

  it("catches an invented SOL figure", () => {
    const draft = "Trading volume hit 5000 SOL this week, a new record.";
    expect(findUnsourcedFigures(draft, FIGURES)).toEqual(["5000 SOL"]);
  });

  it("catches a plausible near-miss, which is the dangerous case", () => {
    // 922.297 is real; 922.5 is the kind of thing a model rounds its way into.
    const draft = "We are at 922.5 SOL all time.";
    expect(findUnsourcedFigures(draft, FIGURES)).toEqual(["922.5 SOL"]);
  });

  it("accepts a supplied figure written with a thousands separator", () => {
    const draft = "Volume is 922.297 SOL and there have been 1,501 battles.";
    // 1,501 is not written as SOL, so it is not challenged; the SOL figure is real.
    expect(findUnsourcedFigures(draft, FIGURES)).toEqual([]);
  });

  it("ignores numbers that are not presented as SOL amounts", () => {
    const draft = "In 2026 we ran 3 tournaments over 12 weeks with 40 artists.";
    expect(findUnsourcedFigures(draft, FIGURES)).toEqual([]);
  });

  it("reports each invented figure once, however often it appears", () => {
    const draft = "It hit 5000 SOL. Yes, 5000 SOL. Truly 5000 SOL.";
    expect(findUnsourcedFigures(draft, FIGURES)).toEqual(["5000 SOL"]);
  });

  it("catches several distinct inventions", () => {
    const draft = "We saw 5000 SOL and paid out 77.7 SOL.";
    expect(findUnsourcedFigures(draft, FIGURES).sort()).toEqual(["5000 SOL", "77.7 SOL"]);
  });

  it("handles an empty draft and empty figures without throwing", () => {
    expect(findUnsourcedFigures("", FIGURES)).toEqual([]);
    expect(findUnsourcedFigures("100 SOL", {})).toEqual(["100 SOL"]);
  });

  it("catches a lowercase unit and normalises it in the report", () => {
    // Matching is case insensitive; the report always says SOL so two
    // spellings of the same invented figure do not read as two problems.
    expect(findUnsourcedFigures("we did 5000 sol", FIGURES)).toEqual(["5000 SOL"]);
    expect(findUnsourcedFigures("5000 sol and 5000 SOL", FIGURES)).toEqual(["5000 SOL"]);
  });
});
