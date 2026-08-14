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

import type { SpeakerLogEntry } from "./types";

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

/** One turn from the diarization transcript - speaker is an anonymous label like "speaker_0". */
export interface DiarizedUtterance {
  speaker: string;
  startSec: number;
  endSec: number;
  text: string;
}

export interface SpeakerMatch {
  speaker: string;
  name: string;
  handle: string | null;
  /** Share of this speaker's matched votes that went to the winning name, 0-1. */
  confidence: number;
  matchedCaptionCount: number;
}

export interface ResolveSpeakersOptions {
  /** Seconds of slack around an utterance's [startSec, endSec] to look for a caption. Default 3. */
  windowSec?: number;
  /** Minimum textSimilarity to count a caption as a candidate match. Default 0.2. */
  minSimilarity?: number;
}

/**
 * Matches diarized utterances to manually-captured captions by time window +
 * text overlap, then votes: each utterance casts one weighted vote (by
 * similarity) for its best-matching caption's (name, handle). A speaker's
 * final name is whichever (name, handle) pair won the most vote-weight
 * across all of that speaker's utterances - so one bad match doesn't flip
 * an otherwise well-identified speaker, and a speaker with zero matches
 * above threshold is simply omitted (caller keeps them anonymous).
 */
export function resolveSpeakerNames(
  utterances: DiarizedUtterance[],
  captions: CaptionEvent[],
  opts: ResolveSpeakersOptions = {},
): SpeakerMatch[] {
  const windowSec = opts.windowSec ?? 3;
  const minSimilarity = opts.minSimilarity ?? 0.2;

  // speaker -> "name::handle" -> accumulated vote weight
  const votes = new Map<string, Map<string, number>>();
  // speaker -> total matched-caption count (denominator for confidence's context)
  const matchedCounts = new Map<string, number>();

  for (const utt of utterances) {
    let best: { caption: CaptionEvent; score: number } | null = null;
    for (const cap of captions) {
      if (cap.timestampSec < utt.startSec - windowSec) continue;
      if (cap.timestampSec > utt.endSec + windowSec) continue;
      const score = textSimilarity(utt.text, cap.text);
      if (score < minSimilarity) continue;
      if (!best || score > best.score) best = { caption: cap, score };
    }
    if (!best) continue;

    const key = `${best.caption.name}::${best.caption.handle ?? ""}`;
    const speakerVotes = votes.get(utt.speaker) ?? new Map<string, number>();
    speakerVotes.set(key, (speakerVotes.get(key) ?? 0) + best.score);
    votes.set(utt.speaker, speakerVotes);
    matchedCounts.set(utt.speaker, (matchedCounts.get(utt.speaker) ?? 0) + 1);
  }

  const results: SpeakerMatch[] = [];
  for (const [speaker, speakerVotes] of votes) {
    let winningKey = "";
    let winningWeight = 0;
    let totalWeight = 0;
    for (const [key, weight] of speakerVotes) {
      totalWeight += weight;
      if (weight > winningWeight) {
        winningWeight = weight;
        winningKey = key;
      }
    }
    const [name, handle] = winningKey.split("::");
    results.push({
      speaker,
      name,
      handle: handle || null,
      confidence: totalWeight === 0 ? 0 : winningWeight / totalWeight,
      matchedCaptionCount: matchedCounts.get(speaker) ?? 0,
    });
  }

  return results.sort((a, b) => a.speaker.localeCompare(b.speaker));
}

export interface BuildSpeakerLogOptions {
  /** Minimum SpeakerMatch.confidence to trust the resolved name. Below this, the
   * speaker's anonymous diarization label is kept instead of guessing. Default 0.5. */
  minConfidence?: number;
}

/**
 * Converts diarized utterances into the SpeakerLogEntry[] shape the recap
 * formatter consumes, substituting each speaker's resolved real name (from
 * resolveSpeakerNames) wherever confidence clears the threshold. Utterances
 * for a speaker with no resolved match, or a match too low-confidence to
 * trust, keep their original anonymous label (e.g. "speaker_3") rather than
 * a guessed name - an unattributed quote beats a wrongly-attributed one.
 */
export function buildSpeakerLog(
  utterances: DiarizedUtterance[],
  matches: SpeakerMatch[],
  opts: BuildSpeakerLogOptions = {},
): SpeakerLogEntry[] {
  const minConfidence = opts.minConfidence ?? 0.5;

  const trusted = new Map<string, SpeakerMatch>();
  for (const match of matches) {
    if (match.confidence >= minConfidence) trusted.set(match.speaker, match);
  }

  return utterances.map((utt) => {
    const match = trusted.get(utt.speaker);
    return {
      timestampSec: utt.startSec,
      speaker: match ? match.name : utt.speaker,
      captionText: utt.text,
    };
  });
}

/**
 * Parses a manually-captured caption log file: one caption per line, each
 * prefixed with the timestamp (in seconds) it appeared at, e.g.
 *   12.5 Hurric4n3Ike @hurric4n3ike: yo whats good everybody
 *   40 Dutchess: this beat go hard
 * Blank lines and lines that don't start with a numeric timestamp are
 * skipped, as are lines whose remainder doesn't parse (see parseCaptionLine).
 */
export function parseCaptionsFile(content: string): CaptionEvent[] {
  const events: CaptionEvent[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
    if (!match) continue;
    const [, timestampStr, rest] = match;

    const event = parseCaptionLine(rest, Number(timestampStr));
    if (event) events.push(event);
  }
  return events;
}
