"use client";

import { C, metaLabel } from "@/lib/theme";
import { SURFACES, buildTally, type Stage } from "@/lib/surfaces";

// Three surfaces, three owners, one build. The point of showing this publicly
// is that a partner deciding whether to integrate can see which parts exist
// and which do not, rather than being told everything is ready.

const STAGE_COLOR: Record<Stage, string> = {
  live: C.accent,
  partial: C.blue,
  blocked: C.danger,
  "not started": C.dim,
};

export default function Surfaces() {
  const tally = buildTally();
  const total = Object.values(tally).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        {(Object.keys(tally) as Stage[]).map((s) => (
          <div key={s}>
            <div style={{ color: STAGE_COLOR[s], fontFamily: C.mono, fontSize: 22 }}>
              {tally[s]}
            </div>
            <div style={{ ...metaLabel, color: C.dim }}>{s}</div>
          </div>
        ))}
        <div>
          <div style={{ color: C.text, fontFamily: C.mono, fontSize: 22 }}>{total}</div>
          <div style={{ ...metaLabel, color: C.dim }}>tracked</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {SURFACES.map((s) => (
          <article key={s.slug} style={{
            border: `1px solid ${C.grid}`, borderRadius: 10,
            background: C.panel, padding: 16,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ color: C.text, fontFamily: C.disp, fontSize: 21, margin: "0 0 2px" }}>
                  {s.name}
                </h3>
                <a href={`https://${s.host}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.blue, fontFamily: C.mono, fontSize: 12.5 }}>
                  {s.host}
                </a>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: C.accent, fontFamily: C.mono, fontSize: 13 }}>{s.owner}</div>
                <div style={{ ...metaLabel, color: C.dim }}>{s.role}</div>
              </div>
            </div>

            <p style={{ color: C.text, fontSize: 14, lineHeight: 1.6, margin: "12px 0 10px" }}>
              {s.summary}
            </p>
            <p style={{ color: C.dim, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 12px" }}>
              <b style={{ color: C.text }}>In the standard:</b> {s.ownsInStandard}
            </p>

            <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
              {s.build.map((b) => (
                <div key={b.step} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span style={{
                    color: STAGE_COLOR[b.stage], fontFamily: C.mono, fontSize: 10.5,
                    minWidth: 78, textTransform: "uppercase", letterSpacing: ".06em",
                  }}>{b.stage}</span>
                  <span style={{ color: C.text, fontSize: 13.5 }}>
                    {b.step}
                    {b.note && (
                      <span style={{ color: C.dim, display: "block", fontSize: 12.5, lineHeight: 1.5 }}>
                        {b.note}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <a href={`/surface/${s.slug}`} style={{ color: C.accent, fontFamily: C.mono, fontSize: 12.5 }}>
              FULL PAGE
            </a>
          </article>
        ))}
      </div>

      <p style={{ color: C.dim, fontSize: 12, fontFamily: C.mono, marginTop: 14 }}>
        Status is measured, not planned. Anything blocked names what is blocking it.
      </p>
    </div>
  );
}
