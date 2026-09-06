// GET /api/admin/facts
//
// The figures a newsletter may state, from the same live sources the site
// renders. Useful on its own - paste them into a hand-written post - and it is
// the same set the AI draft is limited to.

import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/adminAuth";
import { gatherFacts } from "@/lib/newsletterFacts";

export async function GET(): Promise<Response> {
  const jar = await cookies();
  if (!verifyToken(jar.get(COOKIE_NAME)?.value, process.env.ADMIN_PASSWORD)) {
    return new Response(JSON.stringify({ ok: false, error: "Not authorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  const facts = await gatherFacts();
  const ok = facts.lines.length > 0;
  return new Response(JSON.stringify({
    ok,
    facts: facts.lines,
    capturedAt: facts.capturedAt,
    error: ok ? undefined : facts.errors.join("; ") || "No live data available",
  }), { status: ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
}
