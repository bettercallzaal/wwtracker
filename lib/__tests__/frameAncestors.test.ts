/**
 * THE SURFACES THAT CAN MOVE MONEY MUST NOT BE FRAMEABLE BY ANY SITE.
 *
 * Until 2026-09-22 `frame-ancestors` covered `/embed/*` and nothing else,
 * which was backwards: the read-only analytics widgets were restricted to
 * three hosts while `/widget/<id>` - wallet connect, trade, sign - carried no
 * framing header at all. Measured against the running server that day:
 * `/embed/battles` returned the CSP and `/widget/1789948124` returned none.
 *
 * The risk is not that somebody reads a number. It is that a page which asks
 * for a signature can be put under another site's overlay, so a person thinks
 * they are clicking one thing and approves another. The wallet still shows
 * what it is signing, which is the real defence, but it is the last one.
 *
 * Asserted against the config's own `headers()` rather than a copy of the
 * list, so a rule that stops matching a path fails here.
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

const OUR_HOSTS = ["'self'", "https://wavewarz.info", "https://wavewarz.com"];

async function cspFor(pathname: string): Promise<string | null> {
  const rules = await (nextConfig as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> }).headers();
  for (const rule of rules) {
    if (!matches(rule.source, pathname)) continue;
    const h = rule.headers.find((x) => x.key.toLowerCase() === "content-security-policy");
    if (h) return h.value;
  }
  return null;
}

/** Enough of Next's matcher for the shapes this config uses. */
function matches(source: string, pathname: string): boolean {
  const pattern = source
    .replace(/\/:path\(([^)]+)\)\/:rest\*/, "/($1)/.*")
    .replace(/\/:path\(([^)]+)\)$/, "/($1)")
    .replace(/\/embed\/:path\*/, "/embed/.*");
  return new RegExp(`^${pattern}$`).test(pathname);
}

describe("frame-ancestors covers every surface that can sign", () => {
  it.each([
    ["/widget/1789948124", "the trading widget"],
    ["/battle/1789948124", "the battle page, which carries the trade panel when WW_WIDGET is on"],
    ["/claim", "the claim panel"],
    ["/operator", "the settle page"],
  ])("%s is framed only by our own hosts (%s)", async (pathname) => {
    const csp = await cspFor(pathname);
    expect(csp, `${pathname} has no frame-ancestors`).not.toBeNull();
    expect(csp).toContain("frame-ancestors");
    for (const host of OUR_HOSTS) expect(csp).toContain(host);
    // The point of the rule: it is a list, not a wildcard.
    expect(csp).not.toMatch(/frame-ancestors[^;]*\*[^.]/);
  });

  it("still covers the read-only embeds, which is what it always did", async () => {
    expect(await cspFor("/embed/battles")).toContain("frame-ancestors");
  });

  /**
   * The control. If the matcher above is wrong, every assertion in this file
   * passes against a rule that never applied, so something that must NOT match
   * is checked too.
   */
  it("does not accidentally match an unrelated path", async () => {
    expect(await cspFor("/api/ww/battle")).toBeNull();
    expect(await cspFor("/")).toBeNull();
  });
});
