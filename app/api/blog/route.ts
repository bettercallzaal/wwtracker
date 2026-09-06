// GET /api/blog
//
// The WaveWarZ newsletter, served from Paragraph.
//
// Same failure contract as /api/ww/*: 200 with a `status` field, never a 5xx.
// A 5xx pushes consumers into error paths where they render nothing; "unknown"
// rendered as unknown is honest, an empty blog that looks intentional is not.
//
// Server-side and cached, so a page of readers costs Paragraph one request per
// window rather than one per visitor. Same reason the Audius roster walk moved
// server-side: 208 browser requests per visitor became zero.
//
// Response:
//   { status: "live" | "unknown", fetchedAt, posts, source, error? }

import { parseFeed, type BlogPost } from "@/lib/paragraph";

/** paragraph.com/@wavewarz/rss redirects here; using the target directly saves a hop. */
const FEED_URL = "https://api.paragraph.com/blogs/rss/@wavewarz";
const REVALIDATE = 1800; // 30 min. Posts appear a few times a month at most.

export const revalidate = REVALIDATE;

interface BlogPayload {
  status: "live" | "unknown";
  fetchedAt: string;
  posts: BlogPost[];
  source: string;
  error?: string;
}

export async function GET(): Promise<Response> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetch(FEED_URL, {
      headers: { Accept: "application/rss+xml, application/xml, text/xml" },
      next: { revalidate: REVALIDATE },
    });
    if (!res.ok) {
      return json({
        status: "unknown", fetchedAt, posts: [], source: "paragraph.com",
        error: `Feed returned ${res.status}`,
      });
    }
    const posts = parseFeed(await res.text());
    // A feed that parses to nothing is a format change, not an empty blog.
    // Say so rather than rendering a convincing void.
    if (posts.length === 0) {
      return json({
        status: "unknown", fetchedAt, posts: [], source: "paragraph.com",
        error: "Feed fetched but no posts parsed - the format may have changed",
      });
    }
    return json({ status: "live", fetchedAt, posts, source: "paragraph.com" });
  } catch (err) {
    return json({
      status: "unknown", fetchedAt, posts: [], source: "paragraph.com",
      error: err instanceof Error ? err.message : "Feed unreachable",
    });
  }
}

function json(payload: BlogPayload): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Readable from partner sites, same as the other public routes.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, s-maxage=${REVALIDATE}, stale-while-revalidate=86400`,
    },
  });
}
