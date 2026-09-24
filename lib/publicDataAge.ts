/**
 * HOW OLD THE BAKED PUBLIC DATA IS, AND WHY NOBODY NOTICED.
 *
 * The embed widgets draw from four files in `public/`. On 2026-09-24 they were
 * 14 to 19 days old and every chart built from one rendered without saying so,
 * on pages we do not control. #403 made the charts admit their age.
 *
 * THIS IS THE CAUSE RATHER THAN THE SYMPTOM. Looking for the job that should
 * have rebuilt them found that there isn't one:
 *
 *   - `.github/workflows/checks.yml` has a daily 08:30 UTC schedule, and it
 *     runs `smoke:stats` - a contract check against wavewarz.info. It writes
 *     nothing.
 *   - `.github/workflows/live-watch.yml` has no schedule at all; its crons
 *     were removed because they pointed at a September that has passed.
 *   - The only cron in `vercel.json` is `/api/balance?refresh=1`, which
 *     re-runs the Dune treasury query and touches none of these files.
 *
 * So the staleness is not a failed job. **Nothing has ever rebuilt them
 * automatically**, and they move only when somebody runs a script by hand. A
 * reader who assumes a cron exists will keep waiting for it.
 *
 * Whether to automate the rebuild is a decision about what partner pages
 * should show, not a fix to apply quietly - so this module reports, and
 * `scripts/ww-doctor.ts` puts it where somebody looks before a session.
 */

/** A baked file the embeds read, and the command that regenerates it. */
export interface PublicDataFile {
  path: string;
  /** The command that regenerates it, or null when nothing in this repo does. */
  rebuiltBy: string | null;
}

/**
 * THREE OF THESE FOUR HAVE NO GENERATOR IN THIS REPO, and the first version of
 * this file said otherwise.
 *
 * It listed `node scripts/ww-gen.mjs` as the rebuild for the volume and daily
 * files. That script READS them - its own header lists them under "Inputs" -
 * and writes `lib/wwData.ts`. So the instruction sent a reader to a script
 * that consumes the stale file rather than producing it, which is worse than
 * no instruction: it looks like the fix has been tried.
 *
 * Only `ww-battles.json` can be rebuilt from anything in the repo. The other
 * three arrive from Dune exports done by hand, and automating them needs their
 * generators written first. That is the real blocker, and it is work rather
 * than a cron line.
 */
export const PUBLIC_DATA: ReadonlyArray<PublicDataFile> = [
  { path: "public/ww-battles.json", rebuiltBy: "npm run fetch:battles" },
  { path: "public/ww-platform-volume.json", rebuiltBy: null },
  { path: "public/ww-onchain-daily.json", rebuiltBy: null },
  { path: "public/ww-chain-daily.json", rebuiltBy: null },
];

export type DataAgeVerdict = "fresh" | "ageing" | "stale" | "missing";

export interface DataAge {
  path: string;
  rebuiltBy: string | null;
  /** Null when the file is not there at all, which is not an age of zero. */
  days: number | null;
  verdict: DataAgeVerdict;
}

/**
 * `ageingAfterDays` matches `snapshotAge.ts`: under a fortnight, a baked
 * all-time total is not misleading and saying so every day makes a line nobody
 * reads. Past a month it is stale rather than merely ageing, because a chart a
 * month behind is being read as current by somebody.
 */
export function classifyAge(
  days: number | null,
  ageingAfterDays = 14,
  staleAfterDays = 30,
): DataAgeVerdict {
  if (days === null) return "missing";
  if (days >= staleAfterDays) return "stale";
  if (days >= ageingAfterDays) return "ageing";
  return "fresh";
}

/** `mtimeMsFor` returns null for a file that is not there. */
export function publicDataAges(
  mtimeMsFor: (path: string) => number | null,
  now = Date.now(),
  files: ReadonlyArray<PublicDataFile> = PUBLIC_DATA,
): DataAge[] {
  return files.map((f) => {
    const m = mtimeMsFor(f.path);
    // A missing file is not zero days old. Defaulting it to now would report
    // the freshest possible answer for the worst possible state.
    const days = m === null ? null : Math.max(0, Math.floor((now - m) / 86_400_000));
    return { path: f.path, rebuiltBy: f.rebuiltBy, days, verdict: classifyAge(days) };
  });
}

/** The lines a health check prints. Empty when everything is fresh. */
export function describePublicDataAges(ages: DataAge[]): string[] {
  const notable = ages.filter((a) => a.verdict !== "fresh");
  if (notable.length === 0) return [];
  const how = (a: DataAge) =>
    a.rebuiltBy === null
      ? "NOTHING IN THIS REPO REBUILDS IT (a Dune export done by hand)"
      : `rebuild with ${a.rebuiltBy}`;
  const out = notable.map((a) =>
    a.days === null
      ? `${a.path} is MISSING - ${how(a)}`
      : `${a.path} is ${a.days} days old - ${how(a)}`,
  );
  if (notable.some((a) => a.rebuiltBy === null)) {
    out.push(
      "The files with no generator cannot be automated until one is written; that is work, not a cron line.",
    );
  }
  return out;
}
