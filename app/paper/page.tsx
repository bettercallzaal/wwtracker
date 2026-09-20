import { notFound } from "next/navigation";
import { cachedFetch } from "@/lib/wwCache";
import { paperEnabled, PAPER_REVALIDATE_SECONDS } from "@/lib/paperFlag";
import {
  buildFigures,
  renderFigure,
  freshnessNote,
  type Cached,
  type ChainShape,
  type Figure,
  type StatsShape,
} from "@/lib/paperFigures";
import { C } from "@/lib/theme";

/**
 * The dynamic whitepaper. Every number on this page is read at request time and
 * carries the URL it came from and the moment it was read.
 *
 * HOURLY, by Zaal's ruling of 2026-09-20 recorded in the vault: cheapest thing
 * that is no less honest. Recomputing per visitor would hit the upstream API
 * once per reader for a figure that moves in hours; a rebuild an hour means
 * that origin sees one request whatever the traffic, and the as-of stamp makes
 * the staleness visible rather than hiding it.
 *
 * GATED OFF BY DEFAULT AND THE GATE IS A 404. A route on a deployed site is
 * public the moment it exists. Enable with `WW_PAPER=1`.
 */
// A LITERAL, BECAUSE NEXT 16 REQUIRES ONE. It will not accept a computed
// value here and says so with an error that names no file. Kept beside its
// constant so the two cannot drift apart silently - if you change PAPER_REVALIDATE_SECONDS,
// change this. Getting it wrong builds and passes every test.
export const revalidate = 3600; // === PAPER_REVALIDATE_SECONDS

export function generateMetadata() {
  return { robots: { index: false, follow: false }, title: "WaveWarZ, explained" };
}

async function readChain(): Promise<Cached<ChainShape>> {
  // Placeholder envelope until the chain scan is wired in. Deliberately
  // "unknown" with null data rather than zeros: the figures it feeds render as
  // "unavailable", which is true, where a zero would say the program owns no
  // battles.
  return { status: "unknown", fetchedAt: null, ageSeconds: null, data: null };
}

function FigureRow({ f }: { f: Figure }) {
  return (
    <tr>
      <td style={{ padding: "8px 12px 8px 0", color: C.dim }}>{f.label}</td>
      <td style={{ padding: "8px 12px 8px 0", color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>
        {renderFigure(f)}
      </td>
      <td style={{ padding: "8px 0", color: C.dim, fontSize: 12 }}>
        {freshnessNote(f)} ·{" "}
        <a href={f.source.url} target="_blank" rel="noreferrer" style={{ color: C.accent }}>
          {f.source.label}
        </a>
      </td>
    </tr>
  );
}

export default async function PaperPage() {
  if (!paperEnabled()) notFound();

  const stats = await cachedFetch<StatsShape>(
    "paper-stats",
    "https://wavewarz.info/api/public/stats",
    { revalidateSeconds: PAPER_REVALIDATE_SECONDS },
  );
  const figures = buildFigures({ stats: stats as Cached<StatsShape>, chain: await readChain() });

  const unreadable = figures.filter((f) => f.value === null).length;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px", color: C.text }}>
      <h1 style={{ marginBottom: 4 }}>WaveWarZ, explained</h1>
      <p style={{ color: C.dim, marginTop: 0 }}>
        Every number here is read when this page is built, at most an hour ago, and carries the
        source it came from. Nothing on this page is typed in by hand.
      </p>

      <h2 style={{ marginTop: 32 }}>The figures</h2>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <tbody>
          {figures.map((f) => (
            <FigureRow key={f.id} f={f} />
          ))}
        </tbody>
      </table>

      {unreadable > 0 && (
        <p style={{ color: C.dim, marginTop: 16, fontSize: 13 }}>
          {unreadable} of {figures.length} figures could not be read just now. They say so rather
          than showing a zero.
        </p>
      )}
    </main>
  );
}
