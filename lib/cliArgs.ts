/**
 * Reading a named option off a command line, without dropping the first one.
 *
 * WHAT WENT WRONG. Two scripts carried this:
 *
 *     const args = process.argv.slice(2);
 *     const opt = (n, d) => { const i = args.indexOf(n); return i > 0 ? args[i + 1] : d; };
 *
 * On a SLICED array the first user flag sits at index 0, and `i > 0` is false
 * there, so it silently returned the default. `ww-45s-report.ts --marks FILE`
 * read a different file and reported "FILE MISSING: every lag below is
 * UNKNOWN" - about a file the caller had just named on the command line.
 * Found 2026-09-22 about an hour before the report was due to be used on a
 * live session it had never successfully run against.
 *
 * `i > 0` is CORRECT when searching `process.argv` itself, where index 0 is
 * the node binary and 1 is the script, so two other scripts using that form
 * were never affected. The bug is the combination, which is why it survived
 * being read.
 *
 * It fails silently by design of the original: an unknown or misplaced flag
 * produces a default, and a default looks like a choice. `optionValue` takes
 * the array it is given and treats index 0 as a real position.
 */

/** The value after `name`, or `fallback` when the flag is absent. */
export function optionValue(args: readonly string[], name: string, fallback: string): string;
export function optionValue(args: readonly string[], name: string, fallback?: undefined): string | undefined;
export function optionValue(args: readonly string[], name: string, fallback?: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const value = args[i + 1];
  // A flag with nothing after it is a mistake, not a request for the default:
  // `--marks` alone means somebody meant to name a file and did not.
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${name} needs a value`);
  }
  return value;
}

/** True when the flag is present anywhere, including first. */
export function hasFlag(args: readonly string[], name: string): boolean {
  return args.includes(name);
}
