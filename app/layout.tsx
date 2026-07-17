import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wwtracker.vercel.app"),
  title: "WaveWarZ - on-chain tracker",
  description:
    "On-chain analytics for WaveWarZ, the Solana music-battle platform: treasury balance vs the 3.5 SOL floor, battles/trades/traders, and trader PnL. Backed by Dune.",
  openGraph: {
    title: "WaveWarZ - on-chain tracker",
    description:
      "Treasury balance, program activity, and trader PnL for the WaveWarZ Solana music-battle platform.",
    url: "https://wwtracker.vercel.app",
    siteName: "wwtracker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveWarZ - on-chain tracker",
    description:
      "Treasury balance, program activity, and trader PnL for WaveWarZ on Solana.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "wwtracker",
  "description": "Open-source on-chain analytics dashboard for WaveWarZ — the Solana music-battle prediction market inside The ZAO ecosystem.",
  "url": "https://wwtracker.vercel.app",
  "applicationCategory": "FinanceApplication",
  "operatingSystem": "Web",
  "isAccessibleForFree": true,
  "creator": {
    "@type": "Person",
    "name": "Zaal Panthaki",
    "sameAs": ["https://x.com/bettercallzaal", "https://warpcast.com/zaal"],
  },
  "about": {
    "@type": "SoftwareApplication",
    "name": "WaveWarZ",
    "description": "Solana music-battle prediction market — artists compete, fans trade SOL on outcomes, automatic on-chain payouts.",
    "url": "https://wavewarz.info",
    "sameAs": "https://useicm.com/api/objects/wavewarz/llm.txt",
  },
  "isPartOf": {
    "@type": "Organization",
    "name": "The ZAO",
    "alternateName": "ZTalent Artist Organization",
    "url": "https://thezao.com",
    "sameAs": "https://useicm.com/api/objects/icm_ohb0F_XOYDz9Tw_w4yX3PA/llm.txt",
  },
  "codeRepository": "https://github.com/bettercallzaal/wwtracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
