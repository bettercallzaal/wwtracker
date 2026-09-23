/**
 * The 45-second window report: marks typed in the room, samples the watcher
 * recorded, the account's own clock, laid side by side. Written before the
 * first night it runs, so the arithmetic is pinned rather than eyeballed at
 * 9 PM.
 */
import { describe, expect, it } from "vitest";
import { battleWindow, describeWindow, parseMarkLine, parseMarks, windowFromMarks } from "../ww/windowReport";

describe("parseMarkLine", () => {
  it("reads the marker script's format, offset included", () => {
    const m = parseMarkLine("2026-09-21T21:02:14-0400 announce")!;
    expect(m.label).toBe("announce");
    expect(m.t).toBe(Math.floor(Date.parse("2026-09-21T21:02:14-04:00") / 1000));
  });
  it("keeps the whole typed text and lowercases only the label", () => {
    const m = parseMarkLine("2026-09-21T21:02:20-0400 Sent, phantom took 4s")!;
    expect(m.label).toBe("sent,");
    expect(m.raw).toBe("Sent, phantom took 4s");
  });
  it("ignores lines that are not marks", () => {
    expect(parseMarkLine("marking to /tmp/x. Type a word")).toBeNull();
    expect(parseMarks("\n\n2026-09-21T21:02:14-0400 announce\nnoise\n")).toHaveLength(1);
  });
});

describe("battleWindow", () => {
  const open = 1_790_000_000;
  const acct = { startTime: open, endTime: open + 400 };
  const marks = parseMarks(
    [
      `2026-01-01T00:00:00+0000 announce`, // far away, another battle
      ...[
        [open + 45, "announce"],
        [open + 20, "sent"],
        [open + 90, "sent"],
      ].map(([t, l]) => `${new Date(Number(t) * 1000).toISOString().replace(/\.\d{3}Z$/, "+0000")} ${l}`),
    ].join("\n"),
  );
  const samples = [open + 12, open + 30, open + 44, open + 46, open + 200].map((t) => ({ t, a: 1, b: 1, sa: 1, sb: 1 }));

  it("measures the lag from chain open to the announce mark", () => {
    const w = battleWindow(1, acct, marks, samples);
    expect(w.lagSeconds).toBe(45);
    expect(w.announceT).toBe(open + 45);
  });

  it("counts trades that landed before the room heard it", () => {
    const w = battleWindow(1, acct, marks, samples);
    expect(w.tradesTotal).toBe(5);
    expect(w.tradesBeforeAnnounce).toBe(3);
    expect(w.firstTradeT).toBe(open + 12);
  });

  it("places each sent mark relative to open and to the announcement", () => {
    const w = battleWindow(1, acct, marks, samples);
    expect(w.sends).toEqual([
      { t: open + 20, afterOpen: 20, beforeAnnounce: true },
      { t: open + 90, afterOpen: 90, beforeAnnounce: false },
    ]);
  });

  it("says UNKNOWN rather than 0 when no announce mark fell inside the battle", () => {
    const w = battleWindow(2, { startTime: open + 10_000, endTime: open + 10_400 }, marks, []);
    expect(w.lagSeconds).toBeNull();
    expect(describeWindow(w).join("\n")).toMatch(/UNKNOWN/);
    expect(w.sends).toEqual([]);
  });

  it("accepts a mark typed up to a minute before the account's start", () => {
    const early = parseMarks(`${new Date((open - 30) * 1000).toISOString().replace(/\.\d{3}Z$/, "+0000")} announce`);
    expect(battleWindow(1, acct, early, []).lagSeconds).toBe(-30);
  });
});

/**
 * WHICH BATTLES A REPORT COVERS. The report used a hardcoded "last 6 hours",
 * so a session marked at night and reported on the next morning produced
 * "nothing to report" while the marks sat unused. The marks are the session.
 */
describe("windowFromMarks", () => {
  it("spans the first and last mark, padded an hour each way", () => {
    const marks = [
      { t: 1_000_000, label: "announce", raw: "announce" },
      { t: 1_000_600, label: "sent", raw: "sent" },
      { t: 1_000_300, label: "sent", raw: "sent" },
    ];
    const w = windowFromMarks(marks);
    expect(w).toEqual({ fromMs: (1_000_000 - 3600) * 1000, toMs: (1_000_600 + 3600) * 1000 });
  });

  it("does not assume the marks are in order", () => {
    const w = windowFromMarks([
      { t: 500, label: "sent", raw: "sent" },
      { t: 100, label: "announce", raw: "announce" },
    ]);
    expect(w!.fromMs).toBe((100 - 3600) * 1000);
    expect(w!.toMs).toBe((500 + 3600) * 1000);
  });

  it("is null with no marks, so the caller falls back to a clock window and says so", () => {
    expect(windowFromMarks([])).toBeNull();
  });

  it("covers a battle that ran hours ago, which a six-hour clock window would miss", () => {
    const lastNight = Math.floor(Date.parse("2026-09-21T22:30:00-04:00") / 1000);
    const w = windowFromMarks([{ t: lastNight, label: "announce", raw: "announce" }])!;
    const battleFileTouched = Date.parse("2026-09-21T23:14:00-04:00");
    expect(battleFileTouched).toBeGreaterThanOrEqual(w.fromMs);
    expect(battleFileTouched).toBeLessThanOrEqual(w.toMs);
  });
});
