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
