import type { Metadata } from "next";
import "./globals.css";
import { FLOOR_SOL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL("https://wwtracker.vercel.app"),
  title: "WaveWarZ - on-chain tracker",
  description:
    `On-chain analytics for WaveWarZ — the Solana music-battle platform in The ZAO ecosystem. Treasury balance vs the ${FLOOR_SOL} SOL floor, battles/trades/traders, and trader PnL. Backed by Dune.`,
  keywords: [
    "WaveWarZ", "music battle", "Solana", "prediction market", "on-chain analytics",
    "The ZAO", "ZTalent Artist Organization", "music DAO", "crypto music",
    "artist payouts", "DJ Wavy", "web3 music", "Solana DeFi", "music NFT",
  ],
  authors: [{ name: "Zaal Panthaki", url: "https://x.com/bettercallzaal" }],
  alternates: { canonical: "https://wwtracker.vercel.app" },
  openGraph: {
    title: "WaveWarZ - on-chain tracker",
    description:
      "Treasury balance, program activity, and trader PnL for WaveWarZ — the Solana music-battle platform in The ZAO ecosystem.",
    url: "https://wwtracker.vercel.app",
    siteName: "wwtracker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveWarZ - on-chain tracker",
    description:
      "Treasury balance, program activity, and trader PnL for WaveWarZ — a Solana music-battle platform in The ZAO ecosystem.",
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
    "sameAs": ["https://wavewarz.com", "https://x.com/WaveWarZ"],
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

const datasetLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "WaveWarZ Battle Data",
  "description": "1,100+ on-chain music battles on Solana from May 2025 — songs, artists, SOL volume, trader P&L, and artist payouts, all settled by the WaveWarZ program (9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo). Published and maintained by The ZAO.",
  "url": "https://wwtracker.vercel.app",
  "creator": {
    "@type": "Organization",
    "name": "The ZAO",
    "alternateName": "ZTalent Artist Organization",
    "url": "https://thezao.com",
  },
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "datePublished": "2025-05-01",
  "keywords": ["music battles", "WaveWarZ", "Solana", "on-chain analytics", "artist payouts", "prediction market"],
  "measurementTechnique": "Direct on-chain program instruction decoding via Dune Analytics + wavewarz-intelligence feed",
  "variableMeasured": ["battle count", "SOL volume", "artist payouts", "platform revenue", "trader claims"],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
