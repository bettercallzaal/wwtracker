// Paragraph blog ingestion - pure parsing only.
//
// Split from the route for the same reason dune-normalize.ts is split from
// dune.ts: this is the part most likely to break silently when someone else's
// feed format shifts, so it has to be unit-testable without network.
//
// Source: https://api.paragraph.com/blogs/rss/@wavewarz (paragraph.com/@wavewarz/rss
// redirects to it). Standard RSS 2.0 with content:encoded carrying full post HTML.

export interface BlogPost {
  /** Paragraph's own id. Stable across edits, so it is the key to dedupe on. */
  id: string;
  title: string;
  url: string;
  /** ISO 8601. Empty string if the feed gave an unparseable date. */
  publishedAt: string;
  /** Plain-text excerpt from <description>. */
  excerpt: string;
  /** Post body HTML from content:encoded, with scripts and handlers stripped. */
  html: string;
  /** Cover image from <enclosure>, or null. */
  image: string | null;
}

/**
 * Remove anything executable from third-party HTML before it can reach
 * dangerouslySetInnerHTML.
 *
 * This is someone else's HTML arriving over the network. Even from a platform
 * we trust, rendering it unfiltered means a compromise there becomes a
 * compromise here, on a page that may be framed by partner sites. Strip the
 * executable surface and keep the prose.
 */
export function sanitize(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<(object|embed|form|input|button)\b[\s\S]*?<\/\1\s*>/gi, "")
    // Inline handlers: onclick=, onerror=, onload=, quoted or bare.
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // javascript: and data: URLs in href/src.
    .replace(/\s(href|src)\s*=\s*(?:"|')?\s*(?:javascript|data):[^"'>\s]*(?:"|')?/gi, "")
    .trim();
}

/** First matching tag's inner text, or "". Handles CDATA. */
function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}\\s*>`, "i"));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function attr(xml: string, name: string, key: string): string | null {
  const m = xml.match(new RegExp(`<${name}\\b[^>]*\\b${key}\\s*=\\s*"([^"]*)"`, "i"));
  return m ? m[1] : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&"); // last, so &amp;lt; does not become <
}

function toIso(rfc2822: string): string {
  const t = Date.parse(rfc2822);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Parse the feed into posts, newest first.
 *
 * Returns [] rather than throwing on malformed input. A blog section that
 * renders nothing is a bad day; one that throws takes the page with it.
 */
export function parseFeed(xml: string): BlogPost[] {
  if (typeof xml !== "string" || !xml.includes("<item")) return [];
  const items = xml.match(/<item\b[\s\S]*?<\/item\s*>/gi) ?? [];

  return items
    .map((item): BlogPost | null => {
      const title = decodeEntities(tag(item, "title"));
      const url = tag(item, "link");
      if (!title || !url) return null;
      const raw = tag(item, "content:encoded") || tag(item, "description");
      return {
        id: tag(item, "guid") || url,
        title,
        url,
        publishedAt: toIso(tag(item, "pubDate")),
        excerpt: stripTags(tag(item, "description")).slice(0, 320),
        html: sanitize(decodeEntities(raw)),
        image: attr(item, "enclosure", "url"),
      };
    })
    .filter((p): p is BlogPost => p !== null)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
