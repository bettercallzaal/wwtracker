/**
 * The Vercel ignore command, run as a shell against this repo.
 *
 * On 2026-09-27 the daily data-refresh branch showed a FAILED Vercel deployment
 * while every other check passed and the app built clean locally with that
 * exact file. The deploy log said:
 *
 *     fatal: bad object 49191555787ccb4c041bb0a2ea5322832bf83ca9
 *
 * That sha is the PREVIOUS day's `bot/refresh-battles` commit. The branch is
 * deleted after each merge and recreated from main the next morning, so
 * yesterday's tip is unreachable from today's - and Vercel's clone does not
 * have it. The command ran `git diff "$P" "$C"` against it anyway, git exited
 * 128, and Vercel reported a failed deployment.
 *
 * WHICH TURNED MAIN RED, which made zao-merge refuse an unrelated PR, on a
 * branch whose entire content was one number in a JSON file. The build was
 * never the problem and nothing in the app was wrong.
 *
 * It would have recurred every single day, because the condition is "the
 * previous deploy's branch tip was deleted" and that is now the normal
 * lifecycle of that branch.
 *
 * The fix is one clause: check the object exists before diffing against it, and
 * BUILD when it does not. Building unnecessarily costs a build. Exiting 128
 * costs a red main.
 *
 * IT HAS TO FIT IN 256 CHARACTERS, which `scripts/validate.mjs` already
 * enforces and which caught the first draft at 281. Two characters-worth of
 * thinking came out of that: the explicit `[ -z "$P" ]` test is redundant
 * because `git cat-file -e ""` fails anyway, and `^{commit}` is dropped
 * because Vercel only ever supplies a commit sha - a peeling suffix would
 * buy strictness against an input that does not occur. 252 characters.
 *
 * These run the real string out of vercel.json through a real shell, because a
 * test that re-implements the command would pass while the deployed one failed.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const ignoreCommand: string = JSON.parse(readFileSync(`${root}vercel.json`, "utf8")).ignoreCommand;

/** Vercel: exit 0 SKIPS the build, any non-zero PROCEEDS with it. */
function run(previousSha: string, commitSha: string): number {
  try {
    execFileSync("bash", ["-c", ignoreCommand], {
      cwd: root,
      env: { ...process.env, VERCEL_GIT_PREVIOUS_SHA: previousSha, VERCEL_GIT_COMMIT_SHA: commitSha },
      stdio: "pipe",
    });
    return 0;
  } catch (e) {
    return (e as { status?: number }).status ?? -1;
  }
}

const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
/**
 * A well-formed sha that is not an object here.
 *
 * The real one from the incident was 49191555787ccb4c041bb0a2ea5322832bf83ca9,
 * yesterday's bot/refresh-battles tip. It is NOT used: this clone fetched that
 * branch while diagnosing, so the object is present and the case would have
 * tested nothing. The control below caught exactly that on the first run.
 */
const ABSENT = "0123456789abcdef0123456789abcdef01234567";

it("is reading the real command out of vercel.json", () => {
  expect(ignoreCommand).toContain("VERCEL_GIT_PREVIOUS_SHA");
  expect(ignoreCommand).toContain("git diff --quiet");
});

describe("a previous sha this clone does not have", () => {
  it("is genuinely absent here, or this file proves nothing", () => {
    // The positive control. If a later fetch drags that object in, these cases
    // stop testing the branch they were written for and must say so.
    let present = true;
    try {
      execFileSync("git", ["cat-file", "-e", `${ABSENT}^{commit}`], { cwd: root, stdio: "pipe" });
    } catch {
      present = false;
    }
    expect(present, `${ABSENT} is in this clone; pick a sha that is not`).toBe(false);
  });

  it("BUILDS rather than exiting 128", () => {
    const code = run(ABSENT, head);
    expect(code, "128 here is the 2026-09-27 failure: Vercel calls it a failed deployment").not.toBe(128);
    expect(code).not.toBe(0);
  });
});

describe("the cases that already worked keep working", () => {
  it("builds when there is no previous sha at all", () => {
    expect(run("", head)).not.toBe(0);
  });

  it("builds when the previous sha equals the current one", () => {
    expect(run(head, head)).not.toBe(0);
  });

  /**
   * THIS ARM NEEDS TWO COMMITS AND CI HAS ONE, which it took a red CI run to
   * learn. `actions/checkout` clones at depth 1, so `HEAD^` is not an object
   * there and this threw `fatal: ambiguous argument 'HEAD^'` - a test about a
   * command that breaks on a missing git object, breaking on a missing git
   * object.
   *
   * It is SKIPPED rather than quietly passed when the parent is unavailable.
   * A skip is visible in the run output; a `return` would read as a pass and
   * this arm would be untested in CI forever without anyone knowing. The arm
   * does run locally, where the clone is full.
   */
  const parent = (() => {
    try {
      return execFileSync("git", ["rev-parse", "HEAD^"], { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
    } catch {
      return null;
    }
  })();

  it.skipIf(parent === null)("SKIPS when nothing in a watched path moved (needs a parent commit)", () => {
    const touched = execFileSync(
      "git",
      ["diff", "--name-only", parent as string, head, "--", "app", "components", "lib", "public", "scripts",
        "package.json", "package-lock.json", "next.config.mjs", "tsconfig.json", "vercel.json"],
      { cwd: root, encoding: "utf8" },
    ).trim();
    // Only assert the skip when this commit really did leave those paths alone.
    if (touched === "") expect(run(parent as string, head)).toBe(0);
    else expect(run(parent as string, head)).not.toBe(0);
  });
});
