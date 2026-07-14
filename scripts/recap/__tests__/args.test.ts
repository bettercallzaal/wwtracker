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
