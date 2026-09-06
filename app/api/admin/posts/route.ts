// POST  /api/admin/posts        create a post
// PATCH /api/admin/posts        update one  { id, ...fields }
//
// Every request is gated on the signed admin cookie. The Paragraph key lives
// only in this process and is never returned to the caller.

import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/adminAuth";
import { createPost, updatePost, sendTestEmail, ParagraphError, type DraftPost } from "@/lib/paragraphApi";
import { findPublication } from "@/lib/publications";

async function authorized(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE_NAME)?.value, process.env.ADMIN_PASSWORD);
}

function parseDraft(body: Record<string, unknown>): DraftPost | string {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const markdown = typeof body.markdown === "string" ? body.markdown : "";
  if (!title) return "A title is required";
  if (!markdown.trim()) return "The post body is empty";
  const pub = typeof body.publication === "string" ? findPublication(body.publication) : undefined;
  return {
    publicationId: pub?.id,
    title,
    markdown,
    subtitle: typeof body.subtitle === "string" ? body.subtitle : undefined,
    slug: typeof body.slug === "string" && body.slug ? body.slug : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : undefined,
    // Only ever true when explicitly asked for. A newsletter blast cannot be
    // reached by a missing field or a typo.
    sendNewsletter: body.sendNewsletter === true,
  };
}

export async function POST(request: Request): Promise<Response> {
  if (!(await authorized())) return json({ ok: false, error: "Not authorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // Test email is a separate action on an existing post, not a publish.
  if (typeof body.testEmailFor === "string" && typeof body.email === "string") {
    return run(() => sendTestEmail(body.testEmailFor as string, body.email as string));
  }

  const draft = parseDraft(body);
  if (typeof draft === "string") return json({ ok: false, error: draft }, 400);
  return run(() => createPost(draft));
}

export async function PATCH(request: Request): Promise<Response> {
  if (!(await authorized())) return json({ ok: false, error: "Not authorized" }, 401);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return json({ ok: false, error: "A post id is required" }, 400);
  const draft = parseDraft(body);
  if (typeof draft === "string") return json({ ok: false, error: draft }, 400);
  return run(() => updatePost(id, draft));
}

async function run(fn: () => Promise<unknown>): Promise<Response> {
  try {
    return json({ ok: true, result: await fn() }, 200);
  } catch (err) {
    const status = err instanceof ParagraphError ? (err.status ?? 502) : 500;
    const message = err instanceof Error ? err.message : "Request failed";
    return json({ ok: false, error: message }, status);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
