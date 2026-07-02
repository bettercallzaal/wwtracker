import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("writes a header row then data rows", () => {
    expect(toCsv(["a", "b"], [[1, 2]])).toBe("a,b\n1,2");
  });
  it("quotes values containing commas", () => {
    expect(toCsv(["x"], [["a,b"]])).toBe('x\n"a,b"');
  });
  it("escapes embedded quotes by doubling them", () => {
    expect(toCsv(["x"], [['he said "hi"']])).toBe('x\n"he said ""hi"""');
  });
  it("quotes values containing newlines", () => {
    expect(toCsv(["x"], [["a\nb"]])).toBe('x\n"a\nb"');
  });
  it("leaves plain values unquoted", () => {
    expect(toCsv(["x"], [["plain"]])).toBe("x\nplain");
  });
});
