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
 * `Host` is the one header a browser sets that a same-machine request cannot
 * lie about without the operator's own cooperation, and it is what Next gives
 * us without a socket. A forwarded request carries `x-forwarded-host`, so its
 * presence means the request came through something, which is exactly the case
 * to refuse.
 */
function fromLoopback(request: Request): boolean {
  if (request.headers.get("x-forwarded-for") || request.headers.get("x-forwarded-host")) return false;
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return name === "localhost" || name === "127.0.0.1" || name === "::1";
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
