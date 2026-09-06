// POST /api/admin/login  { password }
//
// Exchanges the shared password for a short-lived signed cookie. The password
// itself is never stored client-side and never echoed back.

import { checkPassword, issueToken, COOKIE_NAME, SESSION_TTL_MS } from "@/lib/adminAuth";

export async function POST(request: Request): Promise<Response> {
  let submitted: unknown;
  try {
    submitted = ((await request.json()) as { password?: unknown }).password;
  } catch {
    return json({ ok: false, error: "Malformed request" }, 400);
  }

  const configured = process.env.ADMIN_PASSWORD;
  if (!configured) {
    // Say which side is misconfigured. "Wrong password" when no password is set
    // sends someone to try harder at guessing instead of setting the variable.
    return json({ ok: false, error: "ADMIN_PASSWORD is not set on the server" }, 503);
  }
  if (!checkPassword(submitted, configured)) {
    return json({ ok: false, error: "Incorrect password" }, 401);
  }

  const token = issueToken(configured);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // httpOnly: script on the page cannot read it, so an XSS cannot steal the
      // session. secure + sameSite=strict: not sent over http, not sent
      // cross-site, so it cannot be used from another origin.
      "Set-Cookie": `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
