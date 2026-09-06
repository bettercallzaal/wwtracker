import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeed, sanitize } from "@/lib/paragraph";

// The real feed, captured 2026-09-05 from api.paragraph.com/blogs/rss/@wavewarz.
const FEED = readFileSync(join(__dirname, "..", "__fixtures__", "paragraph-feed.xml"), "utf8");

describe("parseFeed", () => {
  const posts = parseFeed(FEED);

  it("finds both published posts", () => {
    expect(posts).toHaveLength(2);
  });

  it("orders newest first", () => {
    expect(posts[0].title).toBe("WaveWarZ Aftermath: $BONGA vs. $STUPID");
    expect(posts[1].title).toBe("WaveWarZ: The First Ever Live-Traded Memecoin Music Battle");
    expect(posts[0].publishedAt > posts[1].publishedAt).toBe(true);
  });

  it("carries the fields a blog page needs", () => {
    const p = posts[0];
    expect(p.id).toBe("sw5oTMqcvMGT5fu8u60G");
    expect(p.url).toBe("https://paragraph.com/@wavewarz/wavewarz-meme1-aftermath");
    expect(p.publishedAt).toBe("2025-09-23T10:27:09.000Z");
    expect(p.html.length).toBeGreaterThan(1000);
    expect(p.excerpt).toContain("live-traded memecoin music battle");
  });

  it("uses Paragraph's guid as the id, so an edited post does not duplicate", () => {
    expect(posts.every((p) => p.id && !p.id.startsWith("http"))).toBe(true);
    expect(new Set(posts.map((p) => p.id)).size).toBe(posts.length);
  });

  // A blog section rendering nothing is a bad day. One that throws takes the
  // page with it.
  it("returns [] for junk rather than throwing", () => {
    expect(parseFeed("")).toEqual([]);
    expect(parseFeed("<html>not a feed</html>")).toEqual([]);
    expect(parseFeed(undefined as unknown as string)).toEqual([]);
    expect(parseFeed("<rss><channel><item>no title or link</item></channel></rss>")).toEqual([]);
  });

  it("survives an unparseable date without dropping the post", () => {
    const bad = `<rss><channel><item><title>T</title><link>https://x.com/a</link>
      <pubDate>not a date</pubDate></item></channel></rss>`;
    const [p] = parseFeed(bad);
    expect(p.title).toBe("T");
    expect(p.publishedAt).toBe("");
  });
});

// This HTML comes from someone else's server and ends up in
// dangerouslySetInnerHTML, on a page partner sites may frame.
describe("sanitize", () => {
  it("removes script tags and their contents", () => {
    expect(sanitize('<p>hi</p><script>steal()</script>')).toBe("<p>hi</p>");
  });

  it("removes iframes, styles and form controls", () => {
    expect(sanitize('<iframe src="https://evil.test"></iframe><p>a</p>')).toBe("<p>a</p>");
    expect(sanitize('<style>body{display:none}</style><p>a</p>')).toBe("<p>a</p>");
    expect(sanitize('<form action="/x"><input name="p"></input></form><p>a</p>')).toBe("<p>a</p>");
  });

  it("strips inline event handlers, quoted or bare", () => {
    expect(sanitize('<img src="a.png" onerror="steal()">')).toBe('<img src="a.png">');
    expect(sanitize('<div onclick=steal()>x</div>')).toBe("<div>x</div>");
    expect(sanitize("<div onload='steal()'>x</div>")).toBe("<div>x</div>");
  });

  it("strips javascript: and data: URLs", () => {
    expect(sanitize('<a href="javascript:steal()">x</a>')).toBe("<a>x</a>");
    expect(sanitize('<img src="data:text/html;base64,PHNjcmlwdD4=">')).toBe("<img>");
  });

  it("leaves ordinary prose and links alone", () => {
    const ok = '<p>Battle recap with <strong>bold</strong> and <a href="https://wavewarz.info">a link</a>.</p>';
    expect(sanitize(ok)).toBe(ok);
  });

  it("does not mangle the real feed content", () => {
    const [p] = parseFeed(FEED);
    expect(p.html).toContain("<p>");
    expect(p.html).not.toContain("<script");
    expect(p.html).toContain("BONGA");
  });
});
