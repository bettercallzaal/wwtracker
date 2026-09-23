// POST /api/admin/login  { password }
//
// Exchanges the shared password for a short-lived signed cookie. The password
// itself is never stored client-side and never echoed back.
//
// RATE LIMITED, because until 2026-09-23 it was not. `lib/adminAuth.ts` says in
// its own header that this endpoint is public and "an attacker can measure it
// as often as they like" - which was written about timing, and was equally true
// of guessing. One shared password, sized for three people, guarded by a
// constant-time comparison and nothing else, in front of a page that can
// publish under the WaveWarZ name and email every subscriber.
//
// Ten attempts a minute per caller, forty across the server. Generous for
// somebody typing a password they know, useless for working through a list. The
// budget is the same one the relay uses, so there is one implementation of this
// and not two.

import { checkPassword, issueToken, COOKIE_NAME, SESSION_TTL_MS } from "@/lib/adminAuth";
import { RelayBudget, callerKey } from "@/lib/ww/rateLimit";

/** Per-instance, like the relay's. A serverless fleet limits per instance; that is a floor, not a ceiling. */
const logins = new RelayBudget(10, 40);

export async function POST(request: Request): Promise<Response> {
  // Before reading the body: a refusal should cost less than an attempt.
  const decision = logins.take(callerKey(request.headers));
  if (!decision.allowed) {
    return new Response(JSON.stringify({ ok: false, error: `Too many sign-in attempts: ${decision.reason}` }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(decision.retryAfter) },
    });
  }
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
