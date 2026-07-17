import { describe, it, expect } from "vitest";
import { ROSTER, AUDIUS_ID_BY_HANDLE, AUDIUS_HANDLES } from "@/lib/artists";

describe("ROSTER", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(ROSTER)).toBe(true);
    expect(ROSTER.length).toBeGreaterThan(0);
  });

  it("every entry has non-empty handle, audiusId, and note", () => {
    for (const a of ROSTER) {
      expect(a.handle, `handle empty for ${JSON.stringify(a)}`).toBeTruthy();
      expect(a.audiusId, `audiusId empty for ${a.handle}`).toBeTruthy();
      expect(a.note, `note empty for ${a.handle}`).toBeTruthy();
    }
  });

  it("has no duplicate handles", () => {
    const handles = ROSTER.map((a) => a.handle.toLowerCase());
    const unique = new Set(handles);
    expect(unique.size).toBe(handles.length);
  });

  it("has no duplicate audiusIds", () => {
    const ids = ROSTER.map((a) => a.audiusId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe("AUDIUS_ID_BY_HANDLE", () => {
  it("contains every handle in ROSTER", () => {
    for (const a of ROSTER) {
      expect(AUDIUS_ID_BY_HANDLE[a.handle]).toBe(a.audiusId);
    }
  });

  it("size matches ROSTER length", () => {
    expect(Object.keys(AUDIUS_ID_BY_HANDLE).length).toBe(ROSTER.length);
  });
});

describe("AUDIUS_HANDLES", () => {
  it("size matches ROSTER length", () => {
    expect(AUDIUS_HANDLES.size).toBe(ROSTER.length);
  });

  it("contains every handle from ROSTER", () => {
    for (const a of ROSTER) {
      expect(AUDIUS_HANDLES.has(a.handle)).toBe(true);
    }
  });
});
