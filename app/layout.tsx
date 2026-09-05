import type { Metadata } from "next";
import "./globals.css";

// Three faces, three jobs, per the WaveWarZ design system: Rajdhani is the
// arena voice (scoreboard headlines), Inter carries anything a human reads as a
// sentence, and JetBrains Mono is reserved for data, labels and system state.
//
// Loaded by stylesheet rather than next/font/google on purpose. next/font
// fetches the font files at BUILD time, which makes every deploy depend on
// Google being reachable from the build container - if it is not, the build
// fails outright rather than degrading. A stylesheet link moves that dependency
// to the browser, where a failure costs a fallback face instead of a deploy.
// The CSS variable names are unchanged, so lib/theme.ts and globals.css do not
// care which way the files arrive.
const FONT_CSS =
  "https://fonts.googleapis.com/css2" +
  "?family=Inter:wght@400;500;600;700" +
  "&family=JetBrains+Mono:wght@500;700" +
  "&family=Rajdhani:wght@600;700" +
  "&display=swap";

export const metadata: Metadata = {
  metadataBase: new URL("https://wavewarz.info"),
  title: "WaveWarZ Tracker — On-Chain Music Battle Analytics",
  description:
    "Open-source Solana analytics for WaveWarZ: 1,500+ on-chain music battles, 921+ SOL total volume, artist earnings, head-to-head records, and trader P&L. Data: wavewarz.info/api/public/stats.",
  openGraph: {
    title: "WaveWarZ Tracker — On-Chain Music Battle Analytics",
    description:
      "1,500+ battles, 921+ SOL volume, artist earnings and trader P&L for the WaveWarZ Solana music-battle platform.",
    url: "https://wavewarz.info",
    siteName: "WaveWarZ Tracker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveWarZ Tracker — On-Chain Music Battle Analytics",
    description:
      "1,500+ on-chain music battles, 921+ SOL volume, artist earnings and trader P&L for WaveWarZ on Solana.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "WaveWarZ Battle Data",
  description:
    "On-chain music battle records from WaveWarZ on Solana. Includes 1,500 battles (May 2025 to Sep 2026), artist win/loss records, head-to-head rivalries, trading volume (921+ SOL), and estimated artist earnings. Solana program: 9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo.",
  url: "https://wavewarz.info",
  creator: {
    "@type": "Organization",
    name: "The ZAO (ZTalent Artist Organization)",
    url: "https://thezao.xyz",
  },
  license: "https://creativecommons.org/licenses/by/4.0/",
  datePublished: "2025-05-01",
  dateModified: "2026-09-05",
  keywords: [
    "WaveWarZ",
    "Solana",
    "music battles",
    "on-chain analytics",
    "prediction market",
    "music NFT",
    "ZAO",
    "decentralized music",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT_CSS} />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
