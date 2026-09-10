import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync, chmodSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PAGE_MARKER } from "@/lib/liveWatch.mjs";

// A test that FAILS when --notify is broken, not one that passes when it works.
//
// --notify shipped broken and stayed broken until 2026-09-10: `require()` inside
// an ES module, swallowed by a catch, so `npm run watch:live` never posted a
// notification. Nothing noticed, because nothing ran the runner - the tests
// covered the classifier, and the fix was checked by hand. A notifier that
// silently does nothing is the estate's most repeated bug, so this runs the real
// `scripts/live-watch.mjs` as a child process against a local server, with
// LIVE_WATCH_NOTIFIER pointed at a fake that records every call, and asserts on
// what the fake saw. It runs on Linux CI as well as a Mac.
//
// Every way the notification can silently not happen fails a case here: the
// runner throwing before it spawns (the shipped bug), the alert never reaching
// notify(), the wrong condition gating it, or a failed spawn being swallowed.

const RUNNER = "scripts/live-watch.mjs";
let server: Server;
let base = "";
let dir = "";
let fake = "";

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "lw-notify-"));
  fake = join(dir, "fake-notifier.sh");
  // Records its arguments, then exits with FAKE_EXIT so a failing notifier can
  // be simulated too.
  writeFileSync(fake, `#!/bin/sh\nprintf '%s\\n' "$@" >> "$CALLS"\nexit "\${FAKE_EXIT:-0}"\n`);
  chmodSync(fake, 0o755);

  server = createServer((req, res) => {
    const url = req.url ?? "";
    if (url.startsWith("/ok/api/ww/positions")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        status: "live",
        data: { battleId: 1788580997, running: true, truncatedA: false, truncatedB: false },
      }));
    } else if (url.startsWith("/ok/live")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<html><head><title>${PAGE_MARKER}</title></head><body></body></html>`);
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(dir, { recursive: true, force: true });
});

/** Run the real runner once. Async: the server lives in this process. */
function run(opts: { path: string; notify: boolean; fakeExit?: number; calls: string }) {
  const args = [RUNNER, "--base", `${base}${opts.path}`, "--attempts", "1", "--gap", "0",
    "--log", join(dir, "watch.log")];
  if (opts.notify) args.push("--notify");
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, LIVE_WATCH_NOTIFIER: fake, CALLS: opts.calls,
        FAKE_EXIT: String(opts.fakeExit ?? 0) },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const calls = (name: string) => join(dir, `${name}.calls`);

describe("--notify, exercised through the real runner", () => {
  it("an alert with --notify reaches the notifier, carrying the alert code", async () => {
    const r = await run({ path: "/bad", notify: true, calls: calls("alert") });
    expect(r.code).toBe(3);
    // The shipped bug fails exactly here: the runner threw before spawning, so
    // the fake was never called and this file never existed.
    expect(existsSync(calls("alert"))).toBe(true);
    const seen = readFileSync(calls("alert"), "utf8");
    expect(seen).toContain("display notification");
    expect(seen).toMatch(/HTTP_ERROR|PAGE_ERROR/);
    expect(r.stderr).not.toContain("notify FAILED");
  }, 30_000);

  it("a healthy check does not notify (the control - the fake is not always called)", async () => {
    const r = await run({ path: "/ok", notify: true, calls: calls("healthy") });
    expect(r.stdout).toContain("PAGE_OK");
    expect(r.code).toBe(0);
    expect(existsSync(calls("healthy"))).toBe(false);
  }, 30_000);

  it("an alert without --notify does not notify", async () => {
    const r = await run({ path: "/bad", notify: false, calls: calls("off") });
    expect(r.code).toBe(3);
    expect(existsSync(calls("off"))).toBe(false);
  }, 30_000);

  it("a notifier that fails is reported, and does not stop the watcher", async () => {
    const r = await run({ path: "/bad", notify: true, fakeExit: 1, calls: calls("fails") });
    expect(existsSync(calls("fails"))).toBe(true);
    expect(r.stderr).toContain("notify FAILED");
    // Still reports the alert and its severity - the notification is the
    // messenger, not the watch.
    expect(r.stdout).toMatch(/ALERT/);
    expect(r.code).toBe(3);
  }, 30_000);
});
