// The Paragraph publications this composer can write to, and the voice each
// one is written in.
//
// Voices are not decoration. @thezao and @wavewarz read nothing alike, and a
// WaveWarZ-style recap posted to the ZAO newsletter would be obviously
// foreign to anyone who reads it. The style notes below were derived by
// reading the published posts, not invented.

export interface Publication {
  slug: string;
  id: string;
  name: string;
  /** Appended to the system prompt when drafting for this publication. */
  voice: string;
  /** False where we have not confirmed the API key can publish here. */
  writable: boolean;
  note?: string;
}

export const PUBLICATIONS: Publication[] = [
  {
    slug: "wavewarz",
    id: "03UA0mTK3s5mVAF7BWI5",
    name: "WaveWarZ Blog",
    writable: true,
    voice: `Voice: WaveWarZ blog.

Sentence case with normal punctuation. Report what happened at the battles -
who fought, who won, how the crowd moved. Write for people who came for the
music. Explain any mechanic you mention in one clause, because a reader may
have arrived from a link with no context.

Never use hype vocabulary, price talk, or emoji. Hyphens, never em dashes.`,
  },
  {
    slug: "thezao",
    id: "DB7iU1HMVzTT9bI4ec6X",
    name: "The ZAO Newsletter",
    writable: false,
    note: "Publishing here needs an API key with access to that publication. Drafting works now; publishing may 403.",
    voice: `Voice: The ZAO Newsletter. Match it closely, it is distinctive.

All lowercase, including proper nouns and the first word of every line.
No full stops at the end of lines. Short declarative lines, often one clause
each, stacked like a journal rather than joined into paragraphs.

Open with "zm" on its own line. First person, present tense, on the ground.
Concrete and physical: where you are, who you are meeting, what is happening
today. State plans plainly without selling them.

Recurring furniture, used when it fits and never forced: a day counter line in
the form "year of the zabal day N", a song of the day with the artist named,
and the closing line "small moves out loud every day".

Never use emoji, em dashes, hype vocabulary, or marketing register.`,
  },
];

export function findPublication(slug: string): Publication | undefined {
  return PUBLICATIONS.find((p) => p.slug === slug);
}
