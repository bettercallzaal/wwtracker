import type { Metadata } from "next";
import { C } from "@/lib/theme";
import TraderEdge from "@/components/TraderEdge";

export const metadata: Metadata = {
  title: "Trader Edge - WaveWarZ Intelligence",
  description:
    "Every statistical edge in the WaveWarZ battle history, computed live: how often the money favorite wins, which signals predict outcomes, when liquidity shows up, and which artists move the most SOL.",
  openGraph: {
    title: "WaveWarZ Trader Edge",
    description:
      "How often does the money favorite win? Which public signals actually predict battles? Computed live from every battle ever.",
    url: "https://wavewarz.info/edge",
    siteName: "WaveWarZ Intelligence",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveWarZ Trader Edge",
    description:
      "The full battle history, organized into trading signals - favorite win rates, poll accuracy, prime-time liquidity, artist draw power. Live data.",
  },
};

export default function EdgePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: C.bg,
        padding: "clamp(16px, 4vw, 48px)",
      }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            letterSpacing: "0.18em",
            color: C.dim,
            fontFamily: C.mono,
            textTransform: "uppercase",
          }}
        >
          WaveWarZ Intelligence
        </p>
        <h1
          style={{
            margin: "6px 0 6px 0",
            fontSize: "clamp(28px, 5vw, 44px)",
            color: C.text,
            letterSpacing: "0.01em",
          }}
        >
          Trader <span style={{ color: C.accent }}>Edge</span>
        </h1>
        <p style={{ margin: "0 0 22px 0", fontSize: 14, color: C.dim, lineHeight: 1.7, maxWidth: 720 }}>
          Every battle ever, organized into the numbers a trader actually needs: how often the money is
          right, which free signals predict winners, when liquidity shows up, and who moves the market.
          Recomputed from the live public API on every load.
        </p>
        <TraderEdge />
        <p style={{ marginTop: 24, fontSize: 12, color: C.dim, fontFamily: C.mono }}>
          <a href="/" style={{ color: C.accent, textDecoration: "none" }}>
            &larr; back to the full dashboard
          </a>
        </p>
      </div>
    </main>
  );
}
