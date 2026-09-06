# The newsletter

How WaveWarZ posts reach readers, how to write one, and what was measured
about the system on 2026-09-06. Everything here was verified against live
endpoints rather than taken from documentation; where a claim came from
reading a package rather than running it, that is stated.

---

## 1. The fact that motivates all of this

The WaveWarZ blog published twice, in September 2025, and then stopped.

| | |
|---|---|
| Posts | 2 |
| Most recent | 2025-09-23 |
| Silent for | **348 days**, 11.4 months, as of 2026-09-06 |
| Battles run on the platform | 1,501 all time |

The platform did not go quiet. The writing did. When attention is named as the
constraint, this is the first place to look - not "nobody is listening" but
"nothing has been said since September 2025."

---

## 2. Shape of the system

    paragraph.com/@wavewarz          the source of truth for posts
       |                    ^
       | RSS                | REST write
       v                    |
    /api/blog  ---------> section 11 on the site
       ^                    |
       |                    +-- /admin composer
       |
    30 min server-side cache

There is exactly **one copy of any post**, and it lives on Paragraph. A post
written in the composer is published to Paragraph and then read back the same
way a post written on paragraph.com is. Nothing on this site holds post text.

That is the same rule the rest of the repo follows for platform data, for the
same reason: a second copy drifts from the first the moment either is edited.
See `AUDIT.md` section 1 for what it cost when the rule was broken.

---

## 3. Reading posts

**Feed:** `https://api.paragraph.com/blogs/rss/@wavewarz`
(`paragraph.com/@wavewarz/rss` redirects there; using the target saves a hop.)

Standard RSS 2.0. Each item carries `title`, `link`, `guid`, `pubDate`,
`description` as an excerpt, `content:encoded` with the full post HTML, and
`enclosure` with a cover image.

**The `guid` is the post id**, and `lib/paragraph.ts` keys on it. That is why
editing a published post updates the entry on the site instead of adding a
second one.

**Parsing lives in `lib/paragraph.ts`, and it is pure** - no network, so it can
be tested directly. Split out for the same reason as `dune-normalize.ts`: a
third party's format is the thing most likely to change silently.

### Sanitisation is not optional here

Post bodies are HTML from another company's server, rendered through
`dangerouslySetInnerHTML`, on a page partner sites are allowed to frame.
`sanitize()` strips `script`, `style`, `iframe`, `object`, `embed` and form
elements with their contents, inline event handlers whether quoted or bare, and
`javascript:` / `data:` URLs in `href` and `src`. Six tests target those cases
specifically and one asserts real post content survives intact.

### Failure contract

`/api/blog` returns **200 with a `status` field**, never a 5xx - a 5xx pushes
consumers into error paths where they render nothing.

A feed that parses to zero posts returns `unknown` **with an explanation**
rather than an empty list, because a blog section rendering an empty list makes
a claim - that nothing was ever written - which is false.

**Gotcha:** the feed 403s the default Python user-agent. Next's fetch sends a
normal one, so the site is unaffected, but a script against that feed needs a
real UA.

---

## 4. Writing posts

**The npm SDK cannot write.** `@paragraph_xyz/sdk` v0.5.0 has no `createPost`,
no `updatePost`, no `deletePost`, and its constructor takes no API key - zero
matches for `apiKey`, `Authorization` or `Bearer` in the package. It reads only.
This was checked by pulling the tarball, not by reading docs, because the docs
say otherwise.

The write surface is the REST API underneath Paragraph's own MCP server:

    POST   https://public.api.paragraph.com/api/v1/posts
    PATCH  https://public.api.paragraph.com/api/v1/posts/{id}
    POST   https://public.api.paragraph.com/api/v1/posts/{id}/test-email
    Authorization: Bearer $PARAGRAPH_API_KEY

Payload: `publicationId`, `title`, `subtitle`, `slug`, `markdown`, `tags`,
`sendNewsletter`. Endpoints and field names were read out of
`@paragraph-com/mcp` v1.6.0.

**Publication id:** `03UA0mTK3s5mVAF7BWI5` - confirmed against
`/v1/publications/slug/@wavewarz`.

`sendNewsletter: true` is what emails the subscriber list. It defaults to
false everywhere in this codebase and is only ever set from an explicit `true`.

---

## 5. The composer at `/admin`

Password gated. Write markdown, publish, optionally email the list.

### The AI drafts from figures, never from memory

This is the design constraint, and it is the reason to trust the feature.

`lib/newsletterFacts.ts` fetches figures from the same live endpoints the site
renders, and hands them to the model as the only numbers it may state. A model
asked to write about last week's volume will invent a plausible figure; a model
handed `volume total = 922.297 SOL` cannot. If no live data comes back,
generation **refuses** rather than letting the model fill an empty fact sheet.

The fact sheet is displayed next to the draft, verbatim, so the writer can
compare rather than trust.

Then `findUnsourcedFigures` (`lib/newsletterCheck.ts`, pure and tested) scans
the finished draft for any SOL amount that is not in the fact sheet and shows it
in a **CHECK THESE FIGURES** panel. It reports; it never edits. A human decides.

It only challenges numbers written as SOL amounts. Prose legitimately contains
years, counts and ordinals, and a checker that cries wolf gets ignored.

The test case that matters is not `5000 SOL`, which anyone would catch. It is:

    "We are at 922.5 SOL all time."   ->  flagged

The real figure is `922.297`. That is the shape of a rounding a model talks
itself into, and it survives a skim.

### The gate fails closed

`lib/adminAuth.ts` refuses everything when `ADMIN_PASSWORD` is unset, and says
which side is misconfigured rather than "wrong password".

That is the opposite of `lib/refresh-policy.ts`, which fails **open**, and the
difference is what the endpoint does. One re-runs a read-only query where the
worst case is a wasted Dune credit. This one publishes under the WaveWarZ name
and emails the list.

Password comparison is constant-time, sessions are HMAC-signed with the
password so **rotating it revokes every live session**, and the cookie is
`httpOnly; Secure; SameSite=Strict`.

### A blast cannot happen by accident

Ticking the box is not enough. The publish button stays disabled until `SEND` is
typed into a second field. You cannot unsend an email, so it takes a deliberate
second action rather than one stray click.

---

## 6. Environment

| Variable | Required for | If missing |
|---|---|---|
| `PARAGRAPH_API_KEY` | publishing | publish returns a clear 500 |
| `ADMIN_PASSWORD` | reaching `/admin` at all | login returns 503 naming the variable |
| `ANTHROPIC_API_KEY` | AI drafting only | draft returns 503; everything else works |

None of them reach the browser. `lib/paragraphApi.ts` and
`lib/newsletterFacts.ts` import `server-only`, so an accidental client import is
a build error rather than a leak. Verified against the built bundle: all three
appear in **zero** files under `.next/static`.

**Setting a variable is not enough - the site must build again.** Deployments
bake their environment in at build time. See `AUDIT.md` section 6 for the
`ignoreCommand` bug that made this worse than it sounds.

---

## 7. Operating it

Draft, read it, publish without emailing, check it looks right on the site,
then send a test to yourself, and only then blast.

    /admin  ->  SHOW THE NUMBERS  ->  DRAFT WITH AI  ->  read it
            ->  Publish (email box UNTICKED)
            ->  check paragraph.com/@wavewarz and section 11
            ->  SEND TEST to yourself
            ->  only then tick the box and type SEND

New posts appear on the site within 30 minutes with no deploy. To check
immediately:

    curl -s https://wwtracker.vercel.app/api/blog | grep -o '"title":"[^"]*"'
