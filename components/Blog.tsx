"use client";

import { useEffect, useState } from "react";
import { C, metaLabel } from "@/lib/theme";
import type { BlogPost } from "@/lib/paragraph";

// The newsletter, live from Paragraph. Nothing is baked: posts are fetched
// through /api/blog, which caches server-side so readers cost Paragraph one
// request per window rather than one each.
//
// Deliberately not a copy. A pasted post drifts from the published one the
// first time it is edited, which is the same failure that made the no-copying
// rule in docs/AUDIT.md section 1.

const FEED_HOME = "https://paragraph.com/@wavewarz";

interface Payload {
  status: "live" | "unknown";
  posts: BlogPost[];
  error?: string;
}

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export default function Blog() {
  const [data, setData] = useState<Payload | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/blog")
      .then((r) => r.json())
      .then((d: Payload) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData({ status: "unknown", posts: [], error: "Request failed" }); });
    return () => { alive = false; };
  }, []);

  if (!data) {
    return <p style={{ color: C.dim, fontSize: 13.5 }}>Loading posts...</p>;
  }

  // Unknown is rendered as unknown. An empty list styled as a blog would read
  // as "they never wrote anything", which is a different and false claim.
  if (data.status === "unknown") {
    return (
      <div style={{ border: `1px solid ${C.grid}`, borderRadius: 10, padding: 16, background: C.panel }}>
        <p style={{ color: C.text, fontSize: 13.5, margin: 0 }}>
          Posts are unavailable right now.
        </p>
        <p style={{ color: C.dim, fontSize: 12.5, margin: "6px 0 0" }}>
          {data.error ?? "The feed could not be reached."} Read them directly at{" "}
          <a href={FEED_HOME} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>
            paragraph.com/@wavewarz
          </a>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {data.posts.map((post) => {
        const open = openId === post.id;
        return (
          <article
            key={post.id}
            style={{
              border: `1px solid ${C.grid}`, borderRadius: 10,
              background: C.panel, overflow: "hidden",
            }}
          >
            {post.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.image}
                alt=""
                style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
              />
            )}
            <div style={{ padding: 16 }}>
              <div style={{ ...metaLabel, color: C.dim, marginBottom: 6 }}>
                {formatDate(post.publishedAt)}
              </div>
              <h3 style={{
                color: C.text, fontFamily: C.disp, fontSize: 20,
                margin: "0 0 8px", lineHeight: 1.25,
              }}>
                {post.title}
              </h3>

              {open ? (
                <div
                  style={{ color: C.text, fontSize: 14, lineHeight: 1.75 }}
                  // Sanitized in lib/paragraph.ts: scripts, iframes, inline
                  // handlers and javascript:/data: URLs are stripped before
                  // this point. Tested in lib/__tests__/paragraph.test.ts.
                  dangerouslySetInnerHTML={{ __html: post.html }}
                />
              ) : (
                <p style={{ color: C.dim, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                  {post.excerpt}
                </p>
              )}

              <div style={{ display: "flex", gap: 14, marginTop: 12, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : post.id)}
                  style={{
                    background: "transparent", border: `1px solid ${C.grid}`,
                    color: C.accent, borderRadius: 6, padding: "5px 10px",
                    fontSize: 12.5, fontFamily: C.mono, cursor: "pointer",
                  }}
                >
                  {open ? "COLLAPSE" : "READ HERE"}
                </button>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: C.blue, fontSize: 12.5, fontFamily: C.mono }}
                >
                  READ ON PARAGRAPH
                </a>
              </div>
            </div>
          </article>
        );
      })}

      <p style={{ color: C.dim, fontSize: 12, fontFamily: C.mono, margin: 0 }}>
        Source: <a href={FEED_HOME} target="_blank" rel="noopener noreferrer" style={{ color: C.blue }}>
          paragraph.com/@wavewarz
        </a> - fetched live, never copied. New posts appear automatically.
      </p>
    </div>
  );
}
