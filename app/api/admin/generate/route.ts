// POST /api/admin/generate  { angle? }
//
// Drafts a newsletter with Claude, from figures this server fetched rather
// than from anything the model recalls. Returns the draft, the fact sheet it
// was given, and any SOL figure in the draft that is not in that sheet.

import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/adminAuth";
import { gatherFacts, findUnsourcedFigures } from "@/lib/newsletterFacts";
import { findPublication, PUBLICATIONS } from "@/lib/publications";

const SYSTEM = `You write the WaveWarZ newsletter. WaveWarZ is a Solana music-battle platform: two songs go head to head, fans trade SOL on the outcome, and artists earn 1% of every trade - twice what the platform takes.

Rules, in order of importance:

1. NEVER state a number that is not in the FACTS block. Not an approximation, not a rounding, not a "roughly". If a figure you want is not there, write around it or leave it out. Inventing a plausible number is the single worst thing you can do here, because it will be emailed to subscribers as fact.
2. Write for people who like the music, not for crypto traders. No price talk, no "to the moon", no hype vocabulary.
3. Lead with what happened - a battle, a result, an artist - not with statistics. Numbers support the story; they are not the story.
4. Short paragraphs. Markdown. No emoji. No em dashes, use hyphens.
5. Never invent a battle, an artist name, a quote or a result.

Output only the post body in markdown. No title, no preamble, no explanation.`;

export async function POST(request: Request): Promise<Response> {
  const jar = await cookies();
  if (!verifyToken(jar.get(COOKIE_NAME)?.value, process.env.ADMIN_PASSWORD)) {
    return json({ ok: false, error: "Not authorized" }, 401);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ ok: false, error: "ANTHROPIC_API_KEY is not set on the server" }, 503);
  }

  const body = (await request.json().catch(() => ({}))) as { angle?: unknown; publication?: unknown };
  const angle = typeof body.angle === "string" ? body.angle.trim() : "";
  const pub =
    (typeof body.publication === "string" ? findPublication(body.publication) : undefined) ??
    PUBLICATIONS[0];

  const facts = await gatherFacts();
  if (facts.lines.length === 0) {
    // Refuse rather than let the model fill an empty fact sheet from memory.
    return json({ ok: false, error: `No live data available: ${facts.errors.join("; ")}` }, 502);
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: `${SYSTEM}\n\n${pub.voice}`,
      messages: [
        {
          role: "user",
          content:
            `FACTS (captured ${facts.capturedAt}). These are the only numbers you may state:\n\n` +
            facts.lines.join("\n") +
            (angle ? `\n\nThe editor wants this angle: ${angle}` : "") +
            `\n\nWrite the newsletter body.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return json({ ok: false, error: "The model declined this request" }, 502);
    }

    const draft = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return json({
      ok: true,
      draft,
      facts: facts.lines,
      capturedAt: facts.capturedAt,
      publication: pub.slug,
      // Surfaced to the writer, never auto-removed. A human decides.
      unsourced: findUnsourcedFigures(draft, facts.figures),
      warnings: facts.errors,
    }, 200);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return json({ ok: false, error: "ANTHROPIC_API_KEY is not valid" }, 502);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return json({ ok: false, error: "Rate limited by Anthropic - try again shortly" }, 429);
    }
    const msg = err instanceof Error ? err.message : "Generation failed";
    return json({ ok: false, error: msg }, 502);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
