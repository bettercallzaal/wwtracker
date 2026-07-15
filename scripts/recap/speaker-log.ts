/**
 * Turns a manually-captured X Spaces caption feed ("Name @handle: text" lines,
 * each noted with the timestamp it appeared) into structured events, and
 * scores how well two bits of text overlap - the building block for matching
 * an anonymous diarization label (speaker_0, speaker_1...) to a real name.
 *
 * See ~/.claude/skills/identifying-speakers-in-recordings for why capture and
 * seeking stay manual (X's caption feed and slider resist automation) - this
 * module is the automatable part: turning what a human captured into data.
 */

export interface CaptionEvent {
  timestampSec: number;
  name: string;
  handle: string | null;
  text: string;
}

/**
 * Parses one caption line. Accepted shapes, in order of preference:
 *   "Name @handle: text"
 *   "Name: text"
 * Returns null for lines that don't match either shape (blank lines, noise).
 */
export function parseCaptionLine(raw: string, timestampSec: number): CaptionEvent | null {
  const line = raw.trim();
  if (!line) return null;

  const withHandle = line.match(/^(.+?)\s+@(\w+):\s*(.+)$/);
  if (withHandle) {
    const [, name, handle, text] = withHandle;
    if (!text.trim()) return null;
    return { timestampSec, name: name.trim(), handle, text: text.trim() };
  }

  const nameOnly = line.match(/^([^:@]+):\s*(.+)$/);
  if (nameOnly) {
    const [, name, text] = nameOnly;
    if (!text.trim()) return null;
    return { timestampSec, name: name.trim(), handle: null, text: text.trim() };
  }

  return null;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "is", "it",
  "i", "you", "we", "so", "that", "this", "for", "with", "just", "like",
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/**
 * Jaccard overlap of the two texts' significant (non-stopword) tokens.
 * 0 = no shared content, 1 = identical token sets. Deliberately insensitive
 * to word order and repeated caption/transcript wording drift between the
 * two sources (captions and diarized transcript rarely tokenize identically).
 */
export function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalizeWords(a));
  const wordsB = new Set(normalizeWords(b));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
