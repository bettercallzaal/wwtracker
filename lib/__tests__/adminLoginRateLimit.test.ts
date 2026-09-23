/**
 * The sign-in gate is rate limited.
 *
 * Until 2026-09-23 it was not. `lib/adminAuth.ts` says in its own header that
 * this endpoint is public and "an attacker can measure it as often as they
 * like" - written about timing, and equally true of guessing. One shared
 * password, sized for three people who trust each other, in front of a page
 * that can publish under the WaveWarZ name and email every subscriber, with a
 * constant-time comparison and no limit on attempts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const realEnv = process.env;
beforeEach(() => {
  vi.resetModules();
  process.env = { ...realEnv, ADMIN_PASSWORD: "a-password-nobody-will-guess" };
});
afterEach(() => { process.env = realEnv; vi.restoreAllMocks(); });

const attempt = async (POST: (r: Request) => Promise<Response>, password: string, ip = "203.0.113.7") =>
  POST(new Request("http://localhost/api/admin/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ password }),
  }));

describe("POST /api/admin/login", () => {
  it("refuses a wrong password, then stops answering after ten tries a minute", async () => {
    const { POST } = await import("../../app/api/admin/login/route");
    const codes: number[] = [];
    for (let i = 0; i < 13; i++) codes.push((await attempt(POST, `guess-${i}`)).status);
    // The first ten are answered on their merits...
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    // ...and the rest are refused without being checked at all.
    expect(codes.slice(10)).toEqual([429, 429, 429]);
  });

  it("says when to come back, so a real person is not left guessing", async () => {
    const { POST } = await import("../../app/api/admin/login/route");
    for (let i = 0; i < 10; i++) await attempt(POST, "nope", "198.51.100.4");
    const res = await attempt(POST, "nope", "198.51.100.4");
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await res.json()).error).toMatch(/Too many sign-in attempts/);
  });

  /**
   * THE CONTROL. A limiter that refuses everyone is not a limiter, and a test
   * that only ever sees 429 would pass against one.
   */
  it("still lets the right password through", async () => {
    const { POST } = await import("../../app/api/admin/login/route");
    const ok = await attempt(POST, "a-password-nobody-will-guess", "192.0.2.9");
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Set-Cookie")).toMatch(/HttpOnly/);
  });

  it("limits each caller separately, so one attacker cannot lock out the team", async () => {
    const { POST } = await import("../../app/api/admin/login/route");
    for (let i = 0; i < 11; i++) await attempt(POST, "nope", "203.0.113.99");
    const other = await attempt(POST, "a-password-nobody-will-guess", "203.0.113.100");
    expect(other.status).toBe(200);
  });
});
