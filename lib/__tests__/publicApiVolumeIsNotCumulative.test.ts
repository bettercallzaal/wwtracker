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

/**
 * The cited battle has to be the battle.
 *
 * The comment in `measured.ts` first named 1758501426, whose volume has not
 * moved since 2026-09-09. The real one is 1758503315. Both are
 * "$BONGA: VibeLord" vs "$STUPID: Atchblockbaby" on Sep 22 2025, adjacent in
 * the file along with a third, so the wrong id looked exactly as right as the
 * right one - it was read out of a unified diff through `grep`, where `id` is
 * the first key of a record and `vol` the ninth, so the id printed below the
 * changed line belonged to the NEXT record.
 *
 * A prose citation of a row in a data file can be checked against that file.
 * This does that, so the next wrong id fails here rather than being found by
 * somebody reading carefully.
 */
describe("the battle the comment cites", () => {
  const battles = JSON.parse(readFileSync(`${root}public/ww-battles.json`, "utf8")) as Array<{
    id: string; vol: number; a: string; b: string;
  }>;
  const measured = readFileSync(`${root}lib/measured.ts`, "utf8");

  it("is 1758503315, and it carries the post-revision value", () => {
    const row = battles.find((x) => String(x.id) === "1758503315");
    expect(row, "1758503315 is not in public/ww-battles.json").toBeDefined();
    expect(row!.vol).toBe(0.1462);
  });

  it("is cited on the CITATION line, not merely mentioned somewhere in the file", () => {
    // `toContain` over the whole file was the first version of this and it did
    // not fire under mutation: the wrong id can sit on the citation line while
    // the right one still appears in the paragraph explaining the mistake.
    // Anchor on the line that makes the claim.
    const citation = measured.split("\n").find((l) => /^\s*\*\s+battle \d+, /.test(l));
    expect(citation, "no 'battle <id>,' citation line in measured.ts").toBeDefined();
    expect(citation).toContain("1758503315");
    expect(citation).not.toContain("1758501426");
  });

  it("is NOT 1758501426, which never moved and was the first answer", () => {
    // The control. If this row ever reads 0.1462 the two have been confused
    // again, in the data rather than the prose.
    const wrong = battles.find((x) => String(x.id) === "1758501426");
    expect(wrong!.vol).not.toBe(0.1462);
  });

  it("has look-alike neighbours, which is why the id must be checked and not eyeballed", () => {
    const sameBill = battles.filter((x) => x.a === "$BONGA: VibeLord");
    expect(sameBill.length).toBeGreaterThanOrEqual(3);
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
