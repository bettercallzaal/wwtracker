// POST /api/ww/mark   {"label":"announce"}
// GET  /api/ww/mark   -> how many marks are in today's file
//
// The 45-second window needs a mark typed the moment the host opens a round.
// `scripts/ww-mark.sh` has done that since 2026-09-21 and works - `ww-night.sh
// rehearse` proves it every run. FIVE sessions have passed with no marks file
// written, because the step asks for a second terminal to be focused and typed
// into at an exact moment while the operator is also trading and listening.
// This lets the mark come from the page already open in front of them.
//
// THE ONLY WRITING ROUTE IN THE REPO, and it is fenced accordingly:
//
//   1. WW_MARKS must be on. Unset everywhere but the operator's machine, so
//      the public deployment answers 404 and this code never runs there.
//   2. The request must come from loopback. A battle night runs on localhost;
//      nothing off this machine has any business appending to the record.
//   3. The label is checked against an allowlist, not sanitised. The marks
//      file is parsed by line, so a label carrying a newline would forge marks
//      with times nobody recorded.
//   4. The path is built here from the date, never from the request.
//
// It appends and never rewrites: the marks file is a record, and a record that
// a request can overwrite is not one.

import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { acceptMarkLabel, markLine, marksFileName } from "@/lib/ww/markInput";
import { marksEnabled } from "@/lib/ww/marksFlag";
import { notFoundResponse } from "@/lib/ww/apiSurface";

export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Where the marker terminal writes, so both produce one file rather than two. */
function marksDir(): string {
  return process.env.WW_MARKS_DIR || join(process.env.HOME ?? "", "zao-vault", "projects");
}

/**
 * Loopback only.
 *
 * THIS REFUSED EVERY REQUEST EVER MADE TO IT, and the button it guards has
 * therefore never once worked.
 *
 * It used to read: if `x-forwarded-for` or `x-forwarded-host` is present at
 * all, the request came through something, so refuse. That is true of a bare
 * Node server and false of Next, which sets both itself on the way in -
 * `next/dist/server/base-server.js`:
 *
 *     req.headers['x-forwarded-host'] ??= req.headers['host'] ?? this.hostname;
 *     req.headers['x-forwarded-for'] ??= originalRequest?.socket?.remoteAddress;
 *
 * So the disqualifying condition was always met and the route always answered
 * 404. Measured against the running server on 2026-09-26: GET and POST both
 * 404 with `WW_MARKS=1` set and every other flagged surface on the same process
 * answering 200.
 *
 * THE COST OF IT: #389 built this route because "five sessions have produced no
 * marks, so let the mark come from the page". Six sessions have now passed with
 * none. The fix for the missed marks could not be used, and it looked identical
 * to the flag being off, because both return 404 by design.
 *
 * PRESENCE PROVES NOTHING; THE VALUE DOES. Next fills `x-forwarded-for` from
 * the socket, so on a same-machine request it IS a loopback address and on a
 * proxied one it is the real client. Judge what the header says rather than
 * that it exists.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Strip a port and brackets, lowercase - what the operator cannot see. */
function hostName(value: string | null): string {
  return (value ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
}

function fromLoopback(request: Request): boolean {
  if (!LOOPBACK.has(hostName(request.headers.get("host")))) return false;
  // Next copies `host` here, so a mismatch means something rewrote it.
  const forwardedHost = hostName(request.headers.get("x-forwarded-host"));
  if (forwardedHost && !LOOPBACK.has(forwardedHost)) return false;
  // The FIRST hop is the client. A proxy appends, so anything beyond the first
  // entry is a chain we did not make and the first entry is who started it.
  const firstHop = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().toLowerCase();
  if (firstHop && !LOOPBACK.has(firstHop)) return false;
  return true;
}

export async function GET(request: Request) {
  if (!marksEnabled()) return notFoundResponse();
  if (!fromLoopback(request)) return notFoundResponse();
  const path = join(marksDir(), marksFileName(new Date()));
  try {
    const text = await readFile(path, "utf8");
    const marks = text.split("\n").filter((l) => l.trim().length > 0).length;
    return json(200, { status: "ok", marks, file: path });
  } catch (err) {
    // A file that does not exist yet means no marks TODAY, which is a real
    // answer. Any other failure is this machine, and saying "0" for it would
    // be the exact defect this repo keeps finding.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return json(200, { status: "ok", marks: 0, file: path });
    }
    return json(500, { status: "error", reason: (err as Error).message, file: path });
  }
}

export async function POST(request: Request) {
  if (!marksEnabled()) return notFoundResponse();
  if (!fromLoopback(request)) return notFoundResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { status: "error", reason: "body must be JSON" });
  }
  const label = acceptMarkLabel((body as { label?: unknown } | null)?.label);
  if (!label.ok) return json(400, { status: "error", reason: label.reason });

  // Stamped from the clock in the same operation that writes the line.
  const stamp = new Date();
  const path = join(marksDir(), marksFileName(stamp));
  const line = markLine(stamp, label.label);
  try {
    await appendFile(path, line, "utf8");
  } catch (err) {
    // NEVER a success shape on a failed write. The operator is mid-session and
    // has one chance at this moment; a silent failure spends it.
    return json(500, { status: "error", reason: (err as Error).message, file: path });
  }
  return json(200, { status: "ok", line: line.trimEnd(), file: path });
}
