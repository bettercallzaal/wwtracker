import "server-only";

// Write client for Paragraph. Server-only: PARAGRAPH_API_KEY must never reach
// the browser, and importing "server-only" turns an accidental client import
// into a build error rather than a leak.
//
// NOT the npm SDK. @paragraph_xyz/sdk v0.5.0 is read-only - it has no
// createPost, no updatePost, and its constructor takes no API key at all. The
// write surface is the REST API underneath Paragraph's own MCP server, whose
// endpoints and payload shape were read out of that package.
//
//   POST   /api/v1/posts          create
//   PATCH  /api/v1/posts/{id}     update
//   Authorization: Bearer <PARAGRAPH_API_KEY>

const BASE = "https://public.api.paragraph.com/api/v1";

/** WAVEWARZ BLOG. Confirmed via /publications/slug/@wavewarz on 2026-09-06. */
export const PUBLICATION_ID = "03UA0mTK3s5mVAF7BWI5";

export interface DraftPost {
  /** Defaults to the WaveWarZ blog when omitted. */
  publicationId?: string;
  title: string;
  subtitle?: string;
  slug?: string;
  markdown: string;
  tags?: string[];
  /** true emails every subscriber. Defaults false so a blast is never accidental. */
  sendNewsletter?: boolean;
}

export class ParagraphError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ParagraphError";
  }
}

function authHeaders(): Record<string, string> {
  const key = process.env.PARAGRAPH_API_KEY;
  // Load-bearing. Without the check, an unset variable interpolates to the
  // literal "Bearer undefined" and the failure surfaces as a confusing 401 from
  // Paragraph instead of a clear one from us. The same shape shipped as a real
  // vulnerability elsewhere in the estate this week.
  if (!key) throw new ParagraphError("PARAGRAPH_API_KEY is not set", 500);
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    // Surface Paragraph's own message where there is one - a bare status code
    // sends you to the wrong place when the real problem is a rejected field.
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { msg?: string; message?: string; error?: string };
      detail = j.msg ?? j.message ?? j.error ?? detail;
    } catch { /* keep the raw text */ }
    throw new ParagraphError(`Paragraph ${res.status}: ${detail}`, res.status);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface CreatedPost {
  id: string;
  slug?: string;
  title?: string;
}

export function createPost(draft: DraftPost): Promise<CreatedPost> {
  return call<CreatedPost>("/posts", {
    method: "POST",
    body: JSON.stringify({
      publicationId: draft.publicationId ?? PUBLICATION_ID,
      sendNewsletter: false,
      ...draft,
    }),
  });
}

export function updatePost(id: string, draft: Partial<DraftPost>): Promise<CreatedPost> {
  return call<CreatedPost>(`/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(draft),
  });
}

/** Send the post to a named address only. The safe rehearsal before a blast. */
export function sendTestEmail(id: string, email: string): Promise<unknown> {
  return call(`/posts/${encodeURIComponent(id)}/test-email`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
