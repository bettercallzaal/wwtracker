/**
 * Every `export const revalidate` literal still equals the constant it replaced.
 *
 * **THIS TEST EXISTS BECAUSE OF A NEAR-MISS, NOT A FAILURE.** Next 16 refuses a
 * computed value for a route segment config, so five routes that read
 * `export const revalidate = REVALIDATE_SECONDS` had to become literals. While
 * doing that in the audit I typed `30` where the constant is `60`.
 *
 * Both values build. Both pass every other test. Nothing anywhere would have
 * reported it. It would have silently halved the cache TTL on the two public
 * API routes other people's surfaces read, doubling origin traffic, with no
 * error to trace it by - and the only trail back would have been a git blame on
 * a one-character diff.
 *
 * A comment saying "keep these in sync" is the version of this that fails in
 * six weeks. This is the version that does not: it reads both files and
 * compares. If someone changes `REVALIDATE_SECONDS` and forgets the route, this
 * names the route.
 *
 * The literals are parsed out of source rather than imported, because importing
 * them would only prove the module exports what it exports. The point is what
 * the file SAYS, since that is what Next reads.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

/** The `export const revalidate = <n>` a route declares to Next. */
const declaredRevalidate = (file: string): number => {
  const m = read(file).match(/^export const revalidate = (\d+);/m);
  if (!m) throw new Error(`no 'export const revalidate = <literal>' in ${file}`);
  return Number(m[1]);
};

/** The named constant, from wherever it is defined. */
const constantValue = (file: string, name: string): number => {
  const m = read(file).match(new RegExp(`^(?:export )?const ${name} = (\\d+);`, "m"));
  if (!m) throw new Error(`no '${name}' in ${file}`);
  return Number(m[1]);
};

const CASES: { route: string; source: string; constant: string }[] = [
  { route: "app/api/blog/route.ts", source: "app/api/blog/route.ts", constant: "REVALIDATE" },
  { route: "app/api/ww/battle/route.ts", source: "app/api/ww/battle/route.ts", constant: "REVALIDATE" },
  { route: "app/api/ww/leaderboards/[kind]/route.ts", source: "lib/wwPublicRoute.ts", constant: "REVALIDATE_SECONDS" },
  { route: "app/api/ww/stats/route.ts", source: "lib/wwPublicRoute.ts", constant: "REVALIDATE_SECONDS" },
  { route: "app/paper/page.tsx", source: "lib/paperFlag.ts", constant: "PAPER_REVALIDATE_SECONDS" },
];

describe("revalidate literals match their constants", () => {
  it("checks every route that had to be converted, and the list is not empty", () => {
    // Guards the whole file: an empty CASES array would pass every test below.
    expect(CASES).toHaveLength(5);
  });

  for (const c of CASES) {
    it(`${c.route} declares ${c.constant}'s value`, () => {
      expect(declaredRevalidate(c.route)).toBe(constantValue(c.source, c.constant));
    });
  }

  it("fails loudly if a route stops declaring one at all", () => {
    // A route that drops the export is a silent change to caching too, so the
    // helper throws rather than returning a default.
    expect(() => declaredRevalidate("lib/paperFlag.ts")).toThrow(/no 'export const revalidate/);
  });

  it("catches a wrong literal, which is the case it was written for", () => {
    // Proving the check can fail, per the estate's own rule about filters that
    // find nothing. 30 is the number I actually typed.
    expect(30).not.toBe(constantValue("lib/wwPublicRoute.ts", "REVALIDATE_SECONDS"));
  });
});
