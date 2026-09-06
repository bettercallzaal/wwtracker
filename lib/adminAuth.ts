// Auth for the newsletter composer. Pure, so the parts that must not be got
// wrong are testable without a server.
//
// This gate stands in front of a page that can publish under the WaveWarZ name
// and email every subscriber. It is a shared password, which is weak by
// construction - it is sized for three people who already trust each other, not
// for a team. If more people ever need it, this wants real accounts.

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

/** Session lifetime. Short enough that a forgotten open tab is not a standing key. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const COOKIE_NAME = "ww_admin";

/**
 * Constant-time string comparison.
 *
 * A plain `===` on a secret leaks its length and its matching prefix through
 * timing. That matters more here than usual: the endpoint is public, so an
 * attacker can measure it as often as they like.
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself be a signal.
  // Hash both first so the comparison is always over equal-length buffers.
  const ah = createHmac("sha256", "cmp").update(ab).digest();
  const bh = createHmac("sha256", "cmp").update(bb).digest();
  return timingSafeEqual(ah, bh);
}

/**
 * Check a submitted password against the configured one.
 *
 * Fails closed when ADMIN_PASSWORD is unset, and that is deliberate: this gate
 * guards a destructive, outward-facing action, so an unconfigured environment
 * must lock the door rather than open it. That is the opposite of the refresh
 * gate in lib/refresh-policy.ts, which fails open - the difference is what the
 * endpoint does. One re-runs a read-only query; this one emails your list.
 *
 * The `!!configured` is load-bearing. Without it an unset variable would make
 * the empty string a valid password.
 */
export function checkPassword(submitted: unknown, configured: string | undefined): boolean {
  if (!configured) return false;
  if (typeof submitted !== "string" || submitted.length === 0) return false;
  return safeEqual(submitted, configured);
}

/** `<expiryMs>.<hmac>` - signed with the admin password, so rotating it revokes every session. */
export function issueToken(secret: string, now = Date.now()): string {
  const expires = now + SESSION_TTL_MS;
  const nonce = randomBytes(8).toString("hex");
  const body = `${expires}.${nonce}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifyToken(token: unknown, secret: string | undefined, now = Date.now()): boolean {
  if (!secret) return false;
  if (typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, mac] = parts;
  if (!safeEqual(mac, sign(`${expires}.${nonce}`, secret))) return false;
  const exp = Number(expires);
  return Number.isFinite(exp) && exp > now;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
