// Keep credentials out of anything a response body can carry.
//
// This exists because they did not. `/api/ww/positions` reported its own data
// source by echoing `SOLANA_RPC_URL` verbatim, and that URL is a keyed Helius
// endpoint with the key in the query string. The route is CORS-open and returns
// 200 to anyone, so the key was readable by any caller from the day the live
// positions page shipped.
//
// The damage is not abstract. That one key is shared between the production
// /live page and every local chain scan, and its per-minute budget is the thing
// that keeps the page up. Anyone holding it can exhaust it, and the page fails
// in a way that reads as a broken deployment rather than as contention.
//
// `source` is a documented public field and worth keeping - a number with no
// provenance is a rumour. The origin gives the provenance. The query string
// gives away the key, and never carries anything a caller needs.

/**
 * Reduce a URL to scheme and host, dropping path, query and any credentials.
 *
 * Returns a safe constant rather than throwing on unparseable input: this runs
 * inside a response path whose entire job is to keep returning 200 with a
 * truthful status, so it must not be the thing that turns a good response into
 * a 500.
 */
export function redactUrl(raw: string | undefined | null): string {
  if (!raw) return "unset";
  try {
    const u = new URL(raw);
    // Credentials can also arrive as user:pass@host, which `origin` drops.
    return u.origin;
  } catch {
    return "invalid-url";
  }
}

/**
 * True if a string still looks like it carries a secret. Used by the tests that
 * assert no response body can leak one, and cheap enough to assert in a route.
 */
export function looksLikeSecret(s: string): boolean {
  return /(\bapi[-_]?key\b|\bsecret\b|\btoken\b|\bpassword\b)\s*[=:]/i.test(s)
    || /:\/\/[^/@\s]+:[^/@\s]+@/.test(s);
}

/**
 * Strip anything key-shaped out of free text before it reaches a response body.
 *
 * Error messages are the sly path: a route can be careful with every field it
 * builds and still hand back `err.message`, and an RPC failure message can name
 * the endpoint it failed against - which is the keyed one.
 */
export function redactSecrets(s: string): string {
  return s
    // Any URL with credentials or a key-bearing query string collapses to origin.
    .replace(/https?:\/\/[^\s"']+/g, (url) => {
      try {
        const u = new URL(url);
        return u.search || u.username || u.password ? u.origin : url;
      } catch {
        return url;
      }
    })
    // Bare `key=value` pairs that survived, e.g. in a message with no URL.
    .replace(/\b(api[-_]?key|secret|token|password)\s*[=:]\s*[^\s&"']+/gi, "$1=REDACTED");
}
