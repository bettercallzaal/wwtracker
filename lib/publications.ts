// The Paragraph publication this composer writes to, and the voice it is
// written in.
//
// WaveWarZ only, deliberately. Other publications exist in the wider estate
// and this composer does not write to them - the newsletter is a WaveWarZ
// surface and carries WaveWarZ branding, not anyone else's.
//
// The voice below was derived by reading what the blog actually published,
// not invented. It stays a list of one so the shape is here if a second
// WaveWarZ-owned publication ever appears.

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
];

export function findPublication(slug: string): Publication | undefined {
  return PUBLICATIONS.find((p) => p.slug === slug);
}
