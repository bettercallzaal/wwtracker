import { describe, it, expect } from "vitest";
import { SONGS, songsByArtist } from "@/lib/songs";

describe("SONGS", () => {
  it("has at least 37 entries", () => {
    expect(SONGS.length).toBeGreaterThanOrEqual(37);
  });

  it("every entry has required fields with correct types", () => {
    for (const s of SONGS) {
      expect(typeof s.rank, `rank type for "${s.song}"`).toBe("number");
      expect(s.song, `song empty at rank ${s.rank}`).toBeTruthy();
      expect(s.artist, `artist empty at rank ${s.rank}`).toBeTruthy();
      expect(s.genre, `genre empty at rank ${s.rank}`).toBeTruthy();
      expect(typeof s.heat, `heat type for "${s.song}"`).toBe("number");
      expect(typeof s.winPct, `winPct type for "${s.song}"`).toBe("number");
      expect(typeof s.vol, `vol type for "${s.song}"`).toBe("number");
    }
  });

  it("ranks are unique", () => {
    const ranks = SONGS.map((s) => s.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("ranks start at 1 and are sequential", () => {
    const sorted = [...SONGS].sort((a, b) => a.rank - b.rank);
    sorted.forEach((s, i) => {
      expect(s.rank).toBe(i + 1);
    });
  });

  it("heat values are 0–100", () => {
    for (const s of SONGS) {
      expect(s.heat, `heat out of range for "${s.song}"`).toBeGreaterThanOrEqual(0);
      expect(s.heat, `heat out of range for "${s.song}"`).toBeLessThanOrEqual(100);
    }
  });

  it("winPct values are 0–100", () => {
    for (const s of SONGS) {
      expect(s.winPct, `winPct out of range for "${s.song}"`).toBeGreaterThanOrEqual(0);
      expect(s.winPct, `winPct out of range for "${s.song}"`).toBeLessThanOrEqual(100);
    }
  });
});

describe("songsByArtist", () => {
  it("returns songs matching the artist handle", () => {
    const results = songsByArtist("GodclouD");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((s) => s.artist === "GodclouD")).toBe(true);
  });

  it("returns empty array for unknown artist", () => {
    expect(songsByArtist("nobody_here_ever")).toEqual([]);
  });

  it("is case-sensitive (matching songs.ts implementation)", () => {
    expect(songsByArtist("godcloud")).toEqual([]);
    expect(songsByArtist("GodclouD").length).toBeGreaterThan(0);
  });
});
