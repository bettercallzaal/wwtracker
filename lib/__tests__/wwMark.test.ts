/**
 * The only route in this repo that writes a file. Its fences are tested
 * individually, because a route that is safe only when all four hold is a
 * route nobody can reason about.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acceptMarkLabel, markLine, marksFileName, MAX_LABEL_LENGTH } from "../ww/markInput";
import { parseMarkLine } from "../ww/windowReport";

describe("a label is allowed, not sanitised", () => {
  it("takes the two real ones", () => {
    expect(acceptMarkLabel("announce")).toEqual({ ok: true, label: "announce" });
    expect(acceptMarkLabel("sent")).toEqual({ ok: true, label: "sent" });
  });

  it("normalises what the operator cannot see before judging it", () => {
    expect(acceptMarkLabel("  Announce ")).toEqual({ ok: true, label: "announce" });
  });

  it("refuses a newline, which would forge a mark with a time nobody recorded", () => {
    // Short enough that the LENGTH rule cannot be what refuses it: the point
    // is that the character class does.
    const r = acceptMarkLabel("announce\nsent");
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ reason: expect.stringContaining("lowercase letters") });
    // And a carriage return, which also ends a line for a line-based parser.
    expect(acceptMarkLabel("announce\rsent").ok).toBe(false);
  });

  it("refuses a path separator", () => {
    expect(acceptMarkLabel("../../etc/passwd").ok).toBe(false);
    expect(acceptMarkLabel("a/b").ok).toBe(false);
  });

  it("refuses an empty label and a non-string, with the reason", () => {
    expect(acceptMarkLabel("   ")).toEqual({ ok: false, reason: "label is empty" });
    expect(acceptMarkLabel(undefined)).toEqual({ ok: false, reason: "label must be a string" });
    expect(acceptMarkLabel(42)).toEqual({ ok: false, reason: "label must be a string" });
  });

  it("refuses an over-long label at the boundary, not one under it", () => {
    expect(acceptMarkLabel("a".repeat(MAX_LABEL_LENGTH)).ok).toBe(true);
    expect(acceptMarkLabel("a".repeat(MAX_LABEL_LENGTH + 1)).ok).toBe(false);
  });
});

describe("the line it writes is the line the report reads", () => {
  /**
   * The load-bearing assertion. Two writers now append to one file, and a
   * format that differs by a character makes half the marks invisible to
   * `ww-45s-report.ts` while the file looks full.
   */
  it("round-trips through parseMarkLine at the same second", () => {
    const stamp = new Date(2026, 8, 23, 21, 2, 14);
    const line = markLine(stamp, "announce");
    const parsed = parseMarkLine(line.trimEnd());
    expect(parsed).not.toBeNull();
    expect(parsed?.label).toBe("announce");
    expect(parsed?.t).toBe(Math.floor(stamp.getTime() / 1000));
  });

  it("ends with exactly one newline, so two marks are two lines", () => {
    const line = markLine(new Date(), "sent");
    expect(line.endsWith("\n")).toBe(true);
    expect(line.trimEnd()).not.toContain("\n");
  });

  it("pads a single-digit month, day and time the way the parser requires", () => {
    const line = markLine(new Date(2026, 0, 5, 9, 7, 3), "sent");
    expect(line).toMatch(/^2026-01-05T09:07:03[+-]\d{4} sent\n$/);
    expect(parseMarkLine(line.trimEnd())?.label).toBe("sent");
  });
});

describe("the file name matches the marker terminal's", () => {
  it("is the same name scripts/ww-mark.sh builds for the same day", () => {
    expect(marksFileName(new Date(2026, 8, 23, 21, 0, 0))).toBe("ww-45s-marks-2026-09-23.log");
    expect(marksFileName(new Date(2026, 0, 5, 0, 0, 0))).toBe("ww-45s-marks-2026-01-05.log");
  });
});

describe("the route", () => {
  const realEnv = process.env;
  let dir: string;

  beforeEach(() => {
    vi.resetModules();
    dir = mkdtempSync(join(tmpdir(), "ww-marks-"));
    process.env = { ...realEnv, WW_MARKS: "1", WW_MARKS_DIR: dir };
  });
  afterEach(() => {
    process.env = realEnv;
  });

  const post = async (body: unknown, headers: Record<string, string> = { host: "localhost:3520" }) => {
    const { POST } = await import("../../app/api/ww/mark/route");
    return POST(new Request("http://localhost:3520/api/ww/mark", { method: "POST", headers, body: JSON.stringify(body) }));
  };
  const get = async (headers: Record<string, string> = { host: "localhost:3520" }) => {
    const { GET } = await import("../../app/api/ww/mark/route");
    return GET(new Request("http://localhost:3520/api/ww/mark", { headers }));
  };

  it("appends a mark and says where it went", async () => {
    const res = await post({ label: "announce" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.line).toMatch(/ announce$/);
    expect(readFileSync(body.file, "utf8")).toMatch(/ announce\n$/);
  });

  it("appends rather than replaces, because the marks file is a record", async () => {
    await post({ label: "announce" });
    const res = await post({ label: "sent" });
    const { file } = await res.json();
    const lines = readFileSync(file, "utf8").trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/announce$/);
    expect(lines[1]).toMatch(/sent$/);
  });

  it("is 404 when WW_MARKS is off, not 403", async () => {
    process.env = { ...realEnv, WW_MARKS_DIR: dir };
    expect((await post({ label: "announce" })).status).toBe(404);
    expect((await get()).status).toBe(404);
  });

  it("is 404 for a request that did not come from this machine", async () => {
    expect((await post({ label: "announce" }, { host: "wwtracker.vercel.app" })).status).toBe(404);
    expect((await post({ label: "announce" }, { host: "localhost:3520", "x-forwarded-for": "1.2.3.4" })).status).toBe(404);
    expect((await post({ label: "announce" }, { host: "localhost:3520", "x-forwarded-host": "example.com" })).status).toBe(404);
  });

  it("refuses a bad label with the reason, rather than writing something else", async () => {
    const res = await post({ label: "announce\nforged" });
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toMatch(/lowercase letters/);
  });

  it("refuses a body that is not JSON", async () => {
    const { POST } = await import("../../app/api/ww/mark/route");
    const res = await POST(
      new Request("http://localhost:3520/api/ww/mark", { method: "POST", headers: { host: "localhost" }, body: "not json" }),
    );
    expect(res.status).toBe(400);
  });

  it("counts today's marks, and says zero for a day with no file rather than failing", async () => {
    const empty = await (await get()).json();
    expect(empty.marks).toBe(0);
    await post({ label: "announce" });
    await post({ label: "sent" });
    expect((await (await get()).json()).marks).toBe(2);
  });

  it("does not count blank lines as marks", async () => {
    const { file } = await (await post({ label: "announce" })).json();
    writeFileSync(file, readFileSync(file, "utf8") + "\n\n");
    expect((await (await get()).json()).marks).toBe(1);
  });
});
