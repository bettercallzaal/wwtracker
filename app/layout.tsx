import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wavewarz.info"),
  title: "WaveWarZ Tracker — On-Chain Music Battle Analytics",
  description:
    "Open-source Solana analytics for WaveWarZ: 1,245+ on-chain music battles, 524+ SOL total volume, artist earnings, head-to-head records, and trader P&L. Data: wavewarz.info/api/public/stats.",
  openGraph: {
    title: "WaveWarZ Tracker — On-Chain Music Battle Analytics",
    description:
      "1,245+ battles, 524+ SOL volume, artist earnings and trader P&L for the WaveWarZ Solana music-battle platform.",
    url: "https://wavewarz.info",
    siteName: "WaveWarZ Tracker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WaveWarZ Tracker — On-Chain Music Battle Analytics",
    description:
      "1,245+ on-chain music battles, 524+ SOL volume, artist earnings and trader P&L for WaveWarZ on Solana.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "WaveWarZ Battle Data",
  description:
    "On-chain music battle records from WaveWarZ on Solana. Includes 1,245 battles (May 2025–Jul 2026), artist win/loss records, head-to-head rivalries, trading volume (524+ SOL), and estimated artist earnings. Solana program: 9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo.",
  url: "https://wavewarz.info",
  creator: {
    "@type": "Organization",
    name: "The ZAO (ZTalent Artist Organization)",
    url: "https://thezao.xyz",
  },
  license: "https://creativecommons.org/licenses/by/4.0/",
  datePublished: "2025-05-01",
  dateModified: "2026-07-17",
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
