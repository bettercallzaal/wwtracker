import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SURFACES, findSurface, type Stage } from "@/lib/surfaces";
import { C, metaLabel } from "@/lib/theme";

// A page per surface. Static: the set is three and it changes when the company
// changes, not when data does.
export function generateStaticParams() {
  return SURFACES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const s = findSurface((await params).slug);
  if (!s) return { title: "Not found" };
  return {
    title: `${s.name} - ${s.host}`,
    description: s.summary,
  };
}

const STAGE_COLOR: Record<Stage, string> = {
  live: C.accent, partial: C.blue, blocked: C.danger, "not started": C.dim,
};

export default async function SurfacePage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const s = findSurface((await params).slug);
  if (!s) notFound();

  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: "0 20px" }}>
      <a href="/#surfaces" style={{ color: C.dim, fontFamily: C.mono, fontSize: 12.5 }}>
        BACK
      </a>

      <h1 style={{ color: C.text, fontFamily: C.disp, fontSize: 34, margin: "16px 0 4px" }}>
        {s.name}
      </h1>
      <a href={`https://${s.host}`} target="_blank" rel="noopener noreferrer"
        style={{ color: C.blue, fontFamily: C.mono, fontSize: 13 }}>
        {s.host}
      </a>

      <p style={{ color: C.text, fontSize: 16, lineHeight: 1.7, margin: "20px 0" }}>
        {s.summary}
      </p>

      <section style={{ marginBottom: 26 }}>
        <div style={{ ...metaLabel, color: C.dim, marginBottom: 8 }}>Owner</div>
        <div style={{ color: C.accent, fontFamily: C.mono, fontSize: 15 }}>{s.owner}</div>
        <div style={{ color: C.dim, fontSize: 13.5 }}>{s.role}</div>
      </section>

      <section style={{ marginBottom: 26 }}>
        <div style={{ ...metaLabel, color: C.dim, marginBottom: 8 }}>What it holds</div>
        <ul style={{ color: C.text, fontSize: 14, lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
          {s.holds.map((h) => <li key={h}>{h}</li>)}
        </ul>
      </section>

      <section style={{ marginBottom: 26 }}>
        <div style={{ ...metaLabel, color: C.dim, marginBottom: 8 }}>In the standard</div>
        <p style={{ color: C.text, fontSize: 14, lineHeight: 1.7, margin: 0 }}>
          {s.ownsInStandard}
        </p>
      </section>

      <section>
        <div style={{ ...metaLabel, color: C.dim, marginBottom: 10 }}>The build</div>
        <div style={{ display: "grid", gap: 12 }}>
          {s.build.map((b) => (
            <div key={b.step} style={{
              borderLeft: `2px solid ${STAGE_COLOR[b.stage]}`, paddingLeft: 12,
            }}>
              <div style={{
                color: STAGE_COLOR[b.stage], fontFamily: C.mono, fontSize: 10.5,
                textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3,
              }}>{b.stage}</div>
              <div style={{ color: C.text, fontSize: 14.5, lineHeight: 1.5 }}>{b.step}</div>
              {b.note && (
                <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.6, marginTop: 3 }}>
                  {b.note}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <p style={{ color: C.dim, fontSize: 12, fontFamily: C.mono, marginTop: 28 }}>
        Status is measured, not planned. Anything blocked names what is blocking it.
      </p>
    </main>
  );
}
