/**
 * The evidence that the public API's volume is not a lifetime total, kept where
 * deleting it breaks something.
 *
 * On 2026-09-27 four WaveWarZ figures were headed for Zaal's resume, one of
 * them "959 SOL traded" quoted from `wavewarz.info/api/public/stats`. The
 * number is roughly right. The SENTENCE is not, because that field falls as
 * well as rises and a lifetime cumulative cannot fall.
 *
 * `docs/ECOSYSTEM.md` had already recorded the fall - 922.30 then 921.99 - and
 * annotated it "rising again after the drop", which treats the drop as noise on
 * the way up rather than as proof about what the field is. The observation was
 * in the repo for eight days and nobody had drawn the conclusion from it.
 *
 * So the reads are pinned here. A future edit that "tidies" the series into a
 * monotonic one, or drops the inconvenient row, fails this file rather than
 * quietly removing the only evidence for the warning above it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PUBLIC_API_VOLUME_READS, VOLUME_SOL, MEASURED_ON } from "../measured";

const root = fileURLToPath(new URL("../../", import.meta.url));

describe("the public API's volume figure", () => {
  it("has enough reads to say anything at all", () => {
    expect(PUBLIC_API_VOLUME_READS.length).toBeGreaterThanOrEqual(4);
  });

  it("FELL at least once, which is the whole finding", () => {
    const falls = PUBLIC_API_VOLUME_READS.filter(
      (r, i) => i > 0 && r.totalSol < PUBLIC_API_VOLUME_READS[i - 1].totalSol,
    );
    // If this ever passes with zero falls, the series has been edited, not the
    // world corrected: the 2026-09-19 read is in docs/ECOSYSTEM.md.
    expect(falls.length, "no fall in the series - was a row removed?").toBeGreaterThan(0);
  });

  it("is in date order, so 'fell' means fell and not a sorting accident", () => {
    const dates = PUBLIC_API_VOLUME_READS.map((r) => r.on);
    expect(dates).toEqual([...dates].sort());
  });

  it("still has its evidence in docs/ECOSYSTEM.md", () => {
    // The pinned numbers came from that table. If the table loses them, this
    // file is asserting a history with no source, which is the shape it exists
    // to prevent.
    const doc = readFileSync(`${root}docs/ECOSYSTEM.md`, "utf8");
    expect(doc, "ECOSYSTEM.md no longer carries the 921.99 read").toContain("921.99");
    expect(doc, "ECOSYSTEM.md no longer carries the 922.3 read").toContain("922.3");
  });
});

describe("our own VOLUME_SOL, which does not have that problem", () => {
  it("is a figure from a fixed snapshot, and says which day", () => {
    expect(VOLUME_SOL).toBeGreaterThan(0);
    expect(MEASURED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is BELOW the newest public read, as a scan three weeks older should be", () => {
    // A positive control on the comparison itself. If ours ever exceeded the
    // live figure, one of the two is measuring something the other is not, and
    // that is worth knowing rather than assuming.
    const newest = PUBLIC_API_VOLUME_READS[PUBLIC_API_VOLUME_READS.length - 1];
    expect(VOLUME_SOL).toBeLessThan(newest.totalSol);
  });
});
